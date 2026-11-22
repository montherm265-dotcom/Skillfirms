-- The tutor or organisation decides how their certificate is earned:
--   'checks'  pass every lesson's check (the questions they wrote)
--   'project' do a project they set, in a set number of days; they review it
--   'both'    both of the above
-- A learner starts the project (the clock starts), submits a link to the work
-- before the deadline, and the tutor passes it or asks for more work.

alter table public.skillfirms_courses
  add column if not exists certificate_rule text not null default 'checks',
  add column if not exists project_brief text,
  add column if not exists project_days int;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'skillfirms_courses_certificate_rule_check') then
    alter table public.skillfirms_courses add constraint skillfirms_courses_certificate_rule_check check (certificate_rule in ('checks', 'project', 'both'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'skillfirms_courses_project_days_check') then
    alter table public.skillfirms_courses add constraint skillfirms_courses_project_days_check check (project_days is null or project_days between 1 and 90);
  end if;
end $$;

create table if not exists public.skillfirms_course_projects (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  due_at timestamptz not null,
  submitted_at timestamptz,
  work_url text,
  notes text,
  status text not null default 'working' check (status in ('working', 'submitted', 'passed', 'needs_work')),
  review_note text,
  reviewed_at timestamptz,
  unique (course_id, user_id)
);
create index if not exists skillfirms_course_projects_course_idx on public.skillfirms_course_projects (course_id, status);
alter table public.skillfirms_course_projects enable row level security;
drop policy if exists "own or the course's tutor" on public.skillfirms_course_projects;
create policy "own or the course's tutor" on public.skillfirms_course_projects for select using (
  user_id = auth.uid()
  or exists (select 1 from public.skillfirms_courses c join public.skillfirms_experts e on e.id = c.expert_id
             where c.id = course_id and e.profile_id = auth.uid()));
revoke insert, update, delete on public.skillfirms_course_projects from anon, authenticated;
grant select on public.skillfirms_course_projects to authenticated;

-- Issue the certificate once the course's own rule is met.
create or replace function public._skillfirms_maybe_certify(p_user uuid, p_course uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.skillfirms_courses; v_enr uuid; v_total int; v_done int; v_failed int; v_checks_ok boolean; v_project_ok boolean;
begin
  select * into c from public.skillfirms_courses where id = p_course;
  if c.id is null or c.taught_by = 'ai' then return null; end if;
  select id into v_enr from public.skillfirms_enrollments where user_id = p_user and course_id = p_course;
  if v_enr is null then return null; end if;
  select count(*) into v_total from public.skillfirms_course_modules where course_id = p_course;
  select count(*) into v_done from public.skillfirms_module_progress p join public.skillfirms_course_modules m on m.id = p.module_id
    where p.enrollment_id = v_enr and m.course_id = p_course and p.completed_at is not null;
  select count(*) into v_failed from public.skillfirms_course_modules m
    where m.course_id = p_course
      and exists (select 1 from public.skillfirms_module_quiz_questions q where q.module_id = m.id)
      and not exists (select 1 from public.skillfirms_module_progress p where p.enrollment_id = v_enr and p.module_id = m.id and p.quiz_score >= 0.66);
  v_checks_ok := v_done >= v_total and v_failed = 0;
  v_project_ok := exists (select 1 from public.skillfirms_course_projects where course_id = p_course and user_id = p_user and status = 'passed');
  if (c.certificate_rule = 'checks' and v_checks_ok)
     or (c.certificate_rule = 'project' and v_project_ok)
     or (c.certificate_rule = 'both' and v_checks_ok and v_project_ok) then
    return public.skillfirms_issue_or_update_credential(p_user, c.title, 'assessment_based', p_course, null,
      (select assessment_version from public.skillfirms_course_modules where course_id = p_course order by order_index limit 1));
  end if;
  return null;
end;
$$;
revoke all on function public._skillfirms_maybe_certify(uuid, uuid) from public, anon, authenticated;

-- Passing the last check now goes through the course's rule.
select public._edit_fn('public.skillfirms_submit_quiz(uuid,jsonb)'::regprocedure, array[array[
  $a$      perform public.skillfirms_issue_or_update_credential((select auth.uid()), v_course_title, 'assessment_based', v_course_id, null, v_assessment_version);$a$,
  $b$      perform public._skillfirms_maybe_certify((select auth.uid()), v_course_id);$b$]]);

-- Lessons the tutor left without a check (project courses) are marked done.
create or replace function public.skillfirms_finish_lesson(p_module_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_enrollment uuid;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select m.course_id into v_course from public.skillfirms_course_modules m
    join public.skillfirms_courses c on c.id = m.course_id
    where m.id = p_module_id
      and (c.taught_by = 'ai' or not exists (select 1 from public.skillfirms_module_quiz_questions q where q.module_id = m.id));
  if v_course is null then raise exception 'has_check: this lesson ends in your tutor''s check'; end if;
  select id into v_enrollment from public.skillfirms_enrollments where user_id = auth.uid() and course_id = v_course;
  if v_enrollment is null then raise exception 'Not enrolled in this course'; end if;
  insert into public.skillfirms_module_progress (enrollment_id, module_id, completed_at)
  values (v_enrollment, p_module_id, now())
  on conflict (enrollment_id, module_id) do update set completed_at = coalesce(public.skillfirms_module_progress.completed_at, now());
  perform public._skillfirms_maybe_certify(auth.uid(), v_course);
  return true;
end;
$$;
revoke all on function public.skillfirms_finish_lesson(uuid) from public, anon;
grant execute on function public.skillfirms_finish_lesson(uuid) to authenticated;

-- Studio: save, load and submit the rule and the project.
select public._edit_fn('public.skillfirms_studio_save(uuid,jsonb)'::regprocedure, array[
  array[
  $a$  update public.skillfirms_courses set duration_hours = greatest(round(v_minutes / 60.0, 2), 0.1) where id = v_id;$a$,
  $b$  update public.skillfirms_courses set duration_hours = greatest(round(v_minutes / 60.0, 2), 0.1),
    certificate_rule = case when p_course->>'certificate_rule' in ('checks', 'project', 'both') then p_course->>'certificate_rule' else 'checks' end,
    project_brief = nullif(left(btrim(coalesce(p_course->>'project_brief', '')), 6000), ''),
    project_days = case when (p_course->>'project_days') ~ '^[0-9]+$' then least(greatest((p_course->>'project_days')::int, 1), 90) end
  where id = v_id;$b$],
  array[
  $a$    v_i := v_i + 1;
  end loop;$a$,
  $b$    update public.skillfirms_course_modules set has_quiz = v_j > 0 where id = v_mod;
    v_i := v_i + 1;
  end loop;$b$]]);

select public._edit_fn('public.skillfirms_studio_course(uuid)'::regprocedure, array[array[
  $a$'status', v_c.status, 'review_state', v_c.review_state,$a$,
  $b$'status', v_c.status, 'review_state', v_c.review_state,
    'certificate_rule', v_c.certificate_rule, 'project_brief', v_c.project_brief, 'project_days', v_c.project_days,$b$]]);

create or replace function public.skillfirms_studio_submit(p_course_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.skillfirms_courses := public._skillfirms_my_course(p_course_id);
begin
  if v_c.id is null then raise exception 'not_yours'; end if;
  if v_c.status = 'published' then raise exception 'already_published'; end if;
  if (select count(*) from public.skillfirms_course_modules where course_id = v_c.id) < 2 then
    raise exception 'needs_lessons: add at least 2 lessons'; end if;
  if v_c.certificate_rule in ('project', 'both') and (char_length(coalesce(v_c.project_brief, '')) < 40 or v_c.project_days is null) then
    raise exception 'needs_project: describe the project (40+ characters) and how many days learners get'; end if;
  if v_c.certificate_rule in ('checks', 'both') and exists (select 1 from public.skillfirms_course_modules m where m.course_id = v_c.id
             and (select count(*) from public.skillfirms_module_quiz_questions q where q.module_id = m.id) < 3) then
    raise exception 'needs_questions: every lesson needs at least 3 graded questions'; end if;
  if exists (select 1 from public.skillfirms_course_modules m left join public.skillfirms_lessons l on l.module_id = m.id
             where m.course_id = v_c.id and m.video_url is null
               and char_length(coalesce((select string_agg(s->>'body', ' ') from jsonb_array_elements(l.body->'sections') s), '')) < 300) then
    raise exception 'needs_content: every lesson needs a video or at least 300 characters of text'; end if;
  if not exists (select 1 from public.skillfirms_course_skills where course_id = v_c.id) then
    raise exception 'needs_skills: pick the skills this course teaches'; end if;
  update public.skillfirms_courses set review_state = 'submitted', submitted_at = now(), review_note = null where id = v_c.id;
end;
$$;

-- Learners: see, start and hand in the project.
create or replace function public.skillfirms_course_project(p_course uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when c.certificate_rule = 'checks' or c.project_brief is null then null else jsonb_build_object(
    'rule', c.certificate_rule, 'brief', c.project_brief, 'days', c.project_days,
    'mine', (select to_jsonb(p) - 'user_id' from public.skillfirms_course_projects p where p.course_id = c.id and p.user_id = auth.uid())) end
  from public.skillfirms_courses c where c.id = p_course and c.status = 'published';
$$;
grant execute on function public.skillfirms_course_project(uuid) to anon, authenticated;

create or replace function public.skillfirms_start_course_project(p_course uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.skillfirms_courses; v uuid;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select * into c from public.skillfirms_courses where id = p_course and status = 'published';
  if c.id is null or c.certificate_rule = 'checks' or c.project_days is null then raise exception 'no_project'; end if;
  if not exists (select 1 from public.skillfirms_enrollments where user_id = auth.uid() and course_id = p_course) then
    raise exception 'enroll_first: start the course first'; end if;
  if not public.skillfirms_can_open_course(p_course) then raise exception 'buy_first: get the course to do its project'; end if;
  insert into public.skillfirms_course_projects (course_id, user_id, due_at)
  values (p_course, auth.uid(), now() + make_interval(days => c.project_days))
  on conflict (course_id, user_id) do nothing returning id into v;
  return coalesce(v, (select id from public.skillfirms_course_projects where course_id = p_course and user_id = auth.uid()));
end;
$$;
revoke all on function public.skillfirms_start_course_project(uuid) from public, anon;
grant execute on function public.skillfirms_start_course_project(uuid) to authenticated;

create or replace function public.skillfirms_submit_course_project(p_course uuid, p_url text, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p public.skillfirms_course_projects;
begin
  select * into p from public.skillfirms_course_projects where course_id = p_course and user_id = auth.uid();
  if p.id is null then raise exception 'start_first: start the project first'; end if;
  if p.status in ('submitted', 'passed') then raise exception 'already_sent: your tutor has it'; end if;
  if p.status = 'working' and now() > p.due_at then raise exception 'too_late: the time for this project ran out'; end if;
  if coalesce(btrim(p_url), '') !~* '^https?://[^ ]+$' then raise exception 'link: add a link to your work (a shared folder, repo or document)'; end if;
  update public.skillfirms_course_projects set status = 'submitted', submitted_at = now(), work_url = left(btrim(p_url), 1000),
    notes = nullif(left(btrim(coalesce(p_notes, '')), 3000), '') where id = p.id;
end;
$$;
revoke all on function public.skillfirms_submit_course_project(uuid, text, text) from public, anon;
grant execute on function public.skillfirms_submit_course_project(uuid, text, text) to authenticated;

-- Tutors: projects waiting for them, and the decision.
create or replace function public.skillfirms_project_reviews()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'course', jsonb_build_object('title', c.title, 'slug', c.slug),
    'learner', coalesce(pr.display_name, pr.username), 'submitted_at', p.submitted_at, 'due_at', p.due_at,
    'work_url', p.work_url, 'notes', p.notes) order by p.submitted_at), '[]'::jsonb)
  from public.skillfirms_course_projects p
  join public.skillfirms_courses c on c.id = p.course_id
  join public.skillfirms_experts e on e.id = c.expert_id and e.profile_id = auth.uid()
  join public.profiles pr on pr.id = p.user_id
  where p.status = 'submitted';
$$;
revoke all on function public.skillfirms_project_reviews() from public, anon;
grant execute on function public.skillfirms_project_reviews() to authenticated;

create or replace function public.skillfirms_review_course_project(p_id uuid, p_pass boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.skillfirms_course_projects;
begin
  select pp.* into p from public.skillfirms_course_projects pp
    join public.skillfirms_courses c on c.id = pp.course_id
    join public.skillfirms_experts e on e.id = c.expert_id and e.profile_id = auth.uid()
    where pp.id = p_id;
  if p.id is null then raise exception 'not_yours'; end if;
  if p.status <> 'submitted' then raise exception 'not_waiting'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 10 then raise exception 'note: tell them what you saw (10+ characters)'; end if;
  update public.skillfirms_course_projects set status = case when p_pass then 'passed' else 'needs_work' end,
    review_note = left(btrim(p_note), 3000), reviewed_at = now(),
    -- a "needs work" project gets the course's full time again
    due_at = case when p_pass then due_at else now() + make_interval(days => (select project_days from public.skillfirms_courses where id = p.course_id)) end
  where id = p.id;
  if p_pass then perform public._skillfirms_maybe_certify(p.user_id, p.course_id); end if;
end;
$$;
revoke all on function public.skillfirms_review_course_project(uuid, boolean, text) from public, anon;
grant execute on function public.skillfirms_review_course_project(uuid, boolean, text) to authenticated;
