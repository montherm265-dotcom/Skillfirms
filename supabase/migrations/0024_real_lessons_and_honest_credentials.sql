-- Real lessons, and credentials that mean what they say.
--
-- 1. Lessons: until now a lesson was only a title and a one-line
--    description. skillfirms_lessons holds the actual lesson (sections, a
--    worked example, key points, a try-it exercise), written by the
--    skillfirms-lesson Edge Function the first time anyone opens the
--    lesson, then kept for everyone. Each one is labelled as AI-drafted
--    until an expert reviews it. The same step adds a 3-question knowledge
--    check to any lesson that had none.
-- 2. Credentials: passing ONE lesson's quiz used to issue the whole
--    course's verified credential. Now a course credential needs every
--    lesson done and every knowledge check passed (2 of 3 or better). A failed check
--    no longer marks the lesson complete.
-- 3. Scores can't be self-written: quiz_score/attempts are no longer
--    writable from the app, lessons with a knowledge check can only be
--    completed by passing it, and course progress is computed by the
--    database instead of being sent by the browser.

-- 1. Lessons ------------------------------------------------------------------------
create table if not exists public.skillfirms_lessons (
  module_id uuid primary key references public.skillfirms_course_modules(id) on delete cascade,
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  body jsonb,
  source text not null default 'ai_drafted' check (source in ('ai_drafted', 'expert_written')),
  model text,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  error text
);
alter table public.skillfirms_lessons enable row level security;
create policy "ready lessons of published courses are public" on public.skillfirms_lessons for select
  using (status = 'ready' and exists (
    select 1 from public.skillfirms_course_modules m join public.skillfirms_courses c on c.id = m.course_id
    where m.id = module_id and c.status = 'published'));
grant select (module_id, status, body, source, generated_at, reviewed_at) on public.skillfirms_lessons to anon, authenticated;
-- Written only by the Edge Function (service role).

-- 3. No self-written scores --------------------------------------------------------------
revoke insert, update on public.skillfirms_module_progress from authenticated;
grant insert (enrollment_id, module_id, completed_at), update (completed_at) on public.skillfirms_module_progress to authenticated;

-- Runs as the caller (not security definer) so current_user tells a direct
-- write from the app apart from the grading function.
create or replace function public.skillfirms_progress_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Only the grading function (running as the table owner) may complete a
  -- lesson that has a knowledge check.
  if current_user in ('authenticated', 'anon')
     and exists (select 1 from public.skillfirms_module_quiz_questions q where q.module_id = new.module_id) then
    raise exception 'take_the_check: this lesson is completed by passing its knowledge check';
  end if;
  return new;
end;
$$;
create trigger skillfirms_module_progress_guard before insert or update on public.skillfirms_module_progress
  for each row execute function public.skillfirms_progress_guard();

-- Course progress is computed here, not sent by the browser.
revoke insert, update on public.skillfirms_enrollments from authenticated;
grant insert (user_id, course_id) on public.skillfirms_enrollments to authenticated;

create or replace function public.skillfirms_refresh_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course uuid;
  v_total int;
  v_done int;
begin
  select course_id into v_course from public.skillfirms_enrollments where id = coalesce(new.enrollment_id, old.enrollment_id);
  select count(*) into v_total from public.skillfirms_course_modules where course_id = v_course;
  select count(*) into v_done from public.skillfirms_module_progress p
    join public.skillfirms_course_modules m on m.id = p.module_id and m.course_id = v_course
    where p.enrollment_id = coalesce(new.enrollment_id, old.enrollment_id) and p.completed_at is not null;
  update public.skillfirms_enrollments
    set progress_percent = case when v_total > 0 then round(100.0 * v_done / v_total) else 0 end,
        status = case when v_total > 0 and v_done >= v_total then 'completed' else status end,
        completed_at = case when v_total > 0 and v_done >= v_total then coalesce(completed_at, now()) else completed_at end
    where id = coalesce(new.enrollment_id, old.enrollment_id);
  return coalesce(new, old);
end;
$$;
create trigger skillfirms_module_progress_refresh after insert or update or delete on public.skillfirms_module_progress
  for each row execute function public.skillfirms_refresh_enrollment();

-- 2. Grading: pass at 70%, complete only on a pass, credential only when
--    the whole course is done.
create or replace function public.skillfirms_submit_quiz(p_module_id uuid, p_answers jsonb)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_enrollment_id uuid;
  v_course_id uuid;
  v_total integer;
  v_correct integer := 0;
  v_score numeric;
  v_question record;
  v_given integer;
  v_cs record;
  v_course_title text;
  v_assessment_version text;
  v_prior_attempts integer;
  v_prior_last_attempt timestamptz;
  v_next_attempts integer;
  v_fingerprint text;
  v_existing_score numeric;
  v_passed boolean;
  v_course_modules integer;
  v_course_done integer;
  v_checks_failed integer;
begin
  select cm.course_id, cm.assessment_version into v_course_id, v_assessment_version from public.skillfirms_course_modules cm where cm.id = p_module_id;
  if v_course_id is null then raise exception 'Module not found'; end if;

  select e.id into v_enrollment_id from public.skillfirms_enrollments e
    where e.user_id = (select auth.uid()) and e.course_id = v_course_id;
  if v_enrollment_id is null then raise exception 'Not enrolled in this course'; end if;

  select md5(string_agg(q.id::text || ':' || coalesce(p_answers ->> q.id::text, ''), ',' order by q.id))
    into v_fingerprint from public.skillfirms_module_quiz_questions q where q.module_id = p_module_id;

  select score into v_existing_score from public.skillfirms_quiz_submission_fingerprints
    where enrollment_id = v_enrollment_id and module_id = p_module_id and fingerprint = v_fingerprint
      and created_at > now() - interval '5 minutes';
  if v_existing_score is not null then return v_existing_score; end if;

  select mp.attempt_count, mp.last_attempt_at into v_prior_attempts, v_prior_last_attempt
    from public.skillfirms_module_progress mp where mp.enrollment_id = v_enrollment_id and mp.module_id = p_module_id;
  if v_prior_attempts is not null and v_prior_attempts >= 5
     and v_prior_last_attempt is not null and v_prior_last_attempt > now() - interval '24 hours' then
    raise exception 'Too many quiz attempts -- please wait 24 hours before trying again';
  end if;
  v_next_attempts := case
    when v_prior_attempts is null or v_prior_last_attempt is null or v_prior_last_attempt <= now() - interval '24 hours' then 1
    else v_prior_attempts + 1 end;

  select count(*) into v_total from public.skillfirms_module_quiz_questions where module_id = p_module_id;
  if v_total = 0 then raise exception 'This module has no quiz questions'; end if;

  for v_question in select id, correct_index from public.skillfirms_module_quiz_questions where module_id = p_module_id loop
    v_given := (p_answers ->> (v_question.id::text))::integer;
    if v_given = v_question.correct_index then v_correct := v_correct + 1; end if;
  end loop;
  v_score := v_correct::numeric / v_total;
  v_passed := v_score >= 0.66;

  insert into public.skillfirms_quiz_submission_fingerprints (enrollment_id, module_id, fingerprint, score)
  values (v_enrollment_id, p_module_id, v_fingerprint, v_score)
  on conflict (enrollment_id, module_id, fingerprint) do update set score = excluded.score, created_at = excluded.created_at;

  insert into public.skillfirms_module_progress (enrollment_id, module_id, completed_at, quiz_score, attempt_count, last_attempt_at)
  values (v_enrollment_id, p_module_id, case when v_passed then now() end, v_score, v_next_attempts, now())
  on conflict (enrollment_id, module_id) do update set
    completed_at = case when v_passed then coalesce(public.skillfirms_module_progress.completed_at, now()) else public.skillfirms_module_progress.completed_at end,
    quiz_score = greatest(coalesce(public.skillfirms_module_progress.quiz_score, 0), excluded.quiz_score),
    attempt_count = excluded.attempt_count, last_attempt_at = excluded.last_attempt_at;

  if v_passed then
    -- Skill grows with how much of the course is proven so far.
    select count(*) into v_course_modules from public.skillfirms_course_modules where course_id = v_course_id;
    select count(*) into v_course_done from public.skillfirms_module_progress p
      join public.skillfirms_course_modules m on m.id = p.module_id and m.course_id = v_course_id
      where p.enrollment_id = v_enrollment_id and p.completed_at is not null;
    for v_cs in select skill_id, coverage from public.skillfirms_course_skills where course_id = v_course_id loop
      perform public.skillfirms_apply_skill_estimate((select auth.uid()), v_cs.skill_id,
        v_cs.coverage * v_score * v_course_done / greatest(v_course_modules, 1), 'assessment_based');
    end loop;

    -- The credential: every lesson done, every knowledge check passed.
    select count(*) into v_checks_failed from public.skillfirms_course_modules m
      where m.course_id = v_course_id
        and exists (select 1 from public.skillfirms_module_quiz_questions q where q.module_id = m.id)
        and not exists (select 1 from public.skillfirms_module_progress p where p.enrollment_id = v_enrollment_id and p.module_id = m.id and p.quiz_score >= 0.66);
    if v_course_done >= v_course_modules and v_checks_failed = 0 then
      select title into v_course_title from public.skillfirms_courses where id = v_course_id;
      perform public.skillfirms_issue_or_update_credential((select auth.uid()), v_course_title, 'assessment_based', v_course_id, null, v_assessment_version);
    end if;
  end if;

  return v_score;
end;
$function$;
