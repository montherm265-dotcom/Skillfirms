-- 1. Final exam from a question pool.
--    The tutor writes a pool of multiple-choice and written questions (at
--    least twice as many as an exam shows; ~100 recommended) and sets how
--    many each exam shows (e.g. 30), the time limit and the pass mark. Every
--    attempt draws its own random mix, so shared answers stop working.
--    Multiple choice is marked at once; written answers are marked by the
--    tutor, and the result comes within about 2 days. While marking, the
--    tutor sees signals (pasted text, leaving the exam tab, unusually fast
--    writing, an answer identical to another learner's). Nothing fails
--    anyone automatically: the tutor decides.
-- 2. Yearly check: a course is confirmed (or updated) by its tutor at least
--    once every 12 months. Past that, it stops issuing new certificates and
--    exams can't be started until the tutor confirms it again.
-- 3. Projects at scale: a monthly limit on project spots, and/or review by
--    two learners who already hold the course certificate (both pass:
--    passed; both fail: needs work; split: the tutor decides). The tutor can
--    always review any project.

alter table public.skillfirms_courses
  add column if not exists exam_size int check (exam_size between 5 and 100),
  add column if not exists exam_minutes int check (exam_minutes between 10 and 240),
  add column if not exists exam_pass_pct int not null default 70 check (exam_pass_pct between 50 and 100),
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists project_review text not null default 'tutor' check (project_review in ('tutor', 'peer')),
  add column if not exists project_monthly_spots int check (project_monthly_spots between 1 and 100000);

update public.skillfirms_courses set last_reviewed_at = coalesce(published_at, created_at) where last_reviewed_at is null;

create or replace function public._skillfirms_set_reviewed_on_publish()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') and new.last_reviewed_at is null then
    new.last_reviewed_at := now();
  end if;
  return new;
end;
$$;
create or replace trigger skillfirms_reviewed_on_publish before update on public.skillfirms_courses
  for each row execute function public._skillfirms_set_reviewed_on_publish();

create or replace function public.skillfirms_review_overdue(c public.skillfirms_courses)
returns boolean language sql stable set search_path = public as $$
  select c.status = 'published' and coalesce(c.last_reviewed_at, c.published_at, c.created_at) < now() - interval '12 months';
$$;

create table if not exists public.skillfirms_exam_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  kind text not null check (kind in ('mcq', 'written')),
  question text not null check (char_length(question) between 5 and 2000),
  choices jsonb,
  correct_index int,
  model_answer text check (model_answer is null or char_length(model_answer) <= 3000),
  points int not null default 1 check (points between 1 and 10),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'written' or (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 6
         and correct_index >= 0 and correct_index < jsonb_array_length(choices)))
);
create index if not exists skillfirms_exam_questions_course on public.skillfirms_exam_questions (course_id) where retired_at is null;
alter table public.skillfirms_exam_questions enable row level security;

create table if not exists public.skillfirms_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_ids uuid[] not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  submitted_at timestamptz,
  answers jsonb not null default '{}',
  signals jsonb not null default '{}',
  flags jsonb not null default '[]',
  mcq_points int, mcq_max int, written_points int, written_max int,
  marks jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'marking', 'passed', 'failed')),
  result_due_at timestamptz,
  marked_at timestamptz,
  mark_note text
);
create index if not exists skillfirms_exam_attempts_user on public.skillfirms_exam_attempts (user_id, course_id, started_at desc);
create index if not exists skillfirms_exam_attempts_marking on public.skillfirms_exam_attempts (course_id) where status = 'marking';
alter table public.skillfirms_exam_attempts enable row level security;

create table if not exists public.skillfirms_project_peer_reviews (
  project_id uuid not null references public.skillfirms_course_projects(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  pass boolean not null,
  note text not null check (char_length(note) between 10 and 3000),
  created_at timestamptz not null default now(),
  primary key (project_id, reviewer_id)
);
alter table public.skillfirms_project_peer_reviews enable row level security;
-- No policies on the three tables: everything goes through the functions below.

create or replace function public._skillfirms_course_tutor(p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.skillfirms_courses c join public.skillfirms_experts e on e.id = c.expert_id
                 where c.id = p_course and e.profile_id = auth.uid()) or public.skillfirms_is_admin();
$$;
revoke all on function public._skillfirms_course_tutor(uuid) from public, anon, authenticated;

-- ---------- Tutor: building the exam ----------

create or replace function public.skillfirms_studio_exam(p_course uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public._skillfirms_course_tutor(c.id) then null else jsonb_build_object(
    'status', c.status, 'rule', c.certificate_rule, 'size', c.exam_size, 'minutes', c.exam_minutes, 'pass_pct', c.exam_pass_pct,
    'last_reviewed_at', c.last_reviewed_at, 'review_overdue', public.skillfirms_review_overdue(c),
    'project_review', c.project_review, 'project_monthly_spots', c.project_monthly_spots,
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'question', q.question, 'choices', q.choices,
        'correct_index', q.correct_index, 'model_answer', q.model_answer, 'points', q.points) order by q.created_at), '[]')
      from public.skillfirms_exam_questions q where q.course_id = c.id and q.retired_at is null)) end
  from public.skillfirms_courses c where c.id = p_course;
$$;

create or replace function public.skillfirms_studio_save_exam_question(p_course uuid, p_id uuid, p_kind text, p_question text,
  p_choices jsonb, p_correct int, p_model_answer text, p_points int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public._skillfirms_course_tutor(p_course) then raise exception 'not_yours'; end if;
  if p_kind = 'mcq' and (jsonb_typeof(p_choices) <> 'array' or jsonb_array_length(p_choices) < 2
     or exists (select 1 from jsonb_array_elements_text(p_choices) x where btrim(x) = '')) then
    raise exception 'choices: give at least 2 answer choices, none empty'; end if;
  if p_id is not null then
    -- A question someone may already have answered is never changed in place:
    -- the old one is retired and a new one takes its place.
    update public.skillfirms_exam_questions set retired_at = now() where id = p_id and course_id = p_course and retired_at is null;
  end if;
  insert into public.skillfirms_exam_questions (course_id, kind, question, choices, correct_index, model_answer, points)
  values (p_course, p_kind, btrim(p_question), case when p_kind = 'mcq' then p_choices end, case when p_kind = 'mcq' then p_correct end,
          nullif(btrim(coalesce(p_model_answer, '')), ''), coalesce(p_points, 1))
  returning id into v;
  return v;
end;
$$;

create or replace function public.skillfirms_studio_retire_exam_question(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._skillfirms_course_tutor((select course_id from public.skillfirms_exam_questions where id = p_id)) then raise exception 'not_yours'; end if;
  update public.skillfirms_exam_questions set retired_at = now() where id = p_id;
end;
$$;

create or replace function public.skillfirms_studio_set_exam(p_course uuid, p_size int, p_minutes int, p_pass_pct int,
  p_project_review text, p_project_monthly_spots int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._skillfirms_course_tutor(p_course) then raise exception 'not_yours'; end if;
  update public.skillfirms_courses set exam_size = p_size, exam_minutes = case when p_size is null then null else p_minutes end,
    exam_pass_pct = coalesce(p_pass_pct, 70), project_review = coalesce(p_project_review, 'tutor'),
    project_monthly_spots = p_project_monthly_spots
  where id = p_course;
end;
$$;

-- Yearly check: the tutor confirms the course is still right. Certificates
-- held back while it was overdue are issued now.
create or replace function public.skillfirms_confirm_course_review(p_course uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public._skillfirms_course_tutor(p_course) then raise exception 'not_yours'; end if;
  update public.skillfirms_courses set last_reviewed_at = now() where id = p_course;
  for r in select distinct user_id from (
      select user_id from public.skillfirms_exam_attempts where course_id = p_course and status = 'passed'
      union select user_id from public.skillfirms_course_projects where course_id = p_course and status = 'passed') t loop
    perform public._skillfirms_maybe_certify(r.user_id, p_course);
  end loop;
end;
$$;

-- ---------- Learner: taking the exam ----------

create or replace function public._skillfirms_close_exam(p_attempt uuid, p_answers jsonb, p_signals jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare a public.skillfirms_exam_attempts; c public.skillfirms_courses; v_answers jsonb; v_signals jsonb;
  v_mcq int := 0; v_mcq_max int := 0; v_wmax int := 0; v_flags jsonb := '[]'; v_chars int := 0; v_minutes numeric; q record;
begin
  select * into a from public.skillfirms_exam_attempts where id = p_attempt for update;
  if a.id is null or a.status <> 'in_progress' then return; end if;
  select * into c from public.skillfirms_courses where id = a.course_id;
  -- Answers sent after the time (plus 2 minutes' grace) don't count: the
  -- last ones saved in time do.
  v_answers := case when p_answers is not null and now() <= a.ends_at + interval '2 minutes' then p_answers else a.answers end;
  v_signals := coalesce(p_signals, a.signals);
  for q in select * from public.skillfirms_exam_questions where id = any(a.question_ids) loop
    if q.kind = 'mcq' then
      v_mcq_max := v_mcq_max + q.points;
      if (v_answers->>q.id::text) ~ '^\d+$' and (v_answers->>q.id::text)::int = q.correct_index then v_mcq := v_mcq + q.points; end if;
    else
      v_wmax := v_wmax + q.points;
      v_chars := v_chars + char_length(coalesce(v_answers->>q.id::text, ''));
      if char_length(coalesce(v_answers->>q.id::text, '')) >= 60 and exists (
          select 1 from public.skillfirms_exam_attempts o
          where o.course_id = a.course_id and o.user_id <> a.user_id and o.status <> 'in_progress'
            and regexp_replace(lower(o.answers->>q.id::text), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v_answers->>q.id::text), '[^a-z0-9]', '', 'g')) then
        v_flags := v_flags || jsonb_build_array(format('A written answer is word-for-word the same as another learner''s: "%s"', left(q.question, 80)));
      end if;
    end if;
  end loop;
  if coalesce((v_signals->>'pasted_chars')::int, 0) >= 200 then
    v_flags := v_flags || jsonb_build_array(format('Pasted %s characters into answers', v_signals->>'pasted_chars')); end if;
  if coalesce((v_signals->>'blurs')::int, 0) >= 3 then
    v_flags := v_flags || jsonb_build_array(format('Left the exam tab %s times', v_signals->>'blurs')); end if;
  v_minutes := greatest(extract(epoch from (least(now(), a.ends_at) - a.started_at)) / 60, 1);
  if v_chars / v_minutes > 350 then
    v_flags := v_flags || jsonb_build_array(format('Wrote %s characters in %s minutes, faster than people usually type', v_chars, round(v_minutes))); end if;
  update public.skillfirms_exam_attempts set answers = v_answers, signals = v_signals, flags = v_flags,
    submitted_at = least(now(), a.ends_at + interval '2 minutes'), mcq_points = v_mcq, mcq_max = v_mcq_max, written_max = v_wmax,
    status = case when v_wmax = 0 then (case when v_mcq * 100 >= c.exam_pass_pct * greatest(v_mcq_max, 1) then 'passed' else 'failed' end) else 'marking' end,
    marked_at = case when v_wmax = 0 then now() end,
    result_due_at = case when v_wmax > 0 then now() + interval '2 days' end
  where id = a.id;
  if v_wmax = 0 and v_mcq * 100 >= c.exam_pass_pct * greatest(v_mcq_max, 1) then perform public._skillfirms_maybe_certify(a.user_id, a.course_id); end if;
end;
$$;
revoke all on function public._skillfirms_close_exam(uuid, jsonb, jsonb) from public, anon, authenticated;

-- Close my attempts whose time ran out (they count with what was saved).
create or replace function public._skillfirms_close_expired(p_user uuid, p_course uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.skillfirms_exam_attempts
           where user_id = p_user and course_id = p_course and status = 'in_progress' and now() > ends_at + interval '2 minutes' loop
    perform public._skillfirms_close_exam(r.id, null, null);
  end loop;
end;
$$;
revoke all on function public._skillfirms_close_expired(uuid, uuid) from public, anon, authenticated;

create or replace function public.skillfirms_exam_info(p_course uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.skillfirms_courses; v_pool int; v_last public.skillfirms_exam_attempts; v_next timestamptz; v_written int;
begin
  select * into c from public.skillfirms_courses where id = p_course and status = 'published';
  if c.id is null or c.exam_size is null then return null; end if;
  select count(*), count(*) filter (where kind = 'written') into v_pool, v_written
    from public.skillfirms_exam_questions where course_id = c.id and retired_at is null;
  if auth.uid() is not null then
    perform public._skillfirms_close_expired(auth.uid(), c.id);
    select * into v_last from public.skillfirms_exam_attempts where user_id = auth.uid() and course_id = c.id order by started_at desc limit 1;
    if v_last.status = 'failed' then v_next := greatest(v_last.marked_at, v_last.submitted_at) + interval '7 days'; end if;
  end if;
  return jsonb_build_object(
    'size', c.exam_size, 'minutes', c.exam_minutes, 'pass_pct', c.exam_pass_pct, 'has_written', v_written > 0,
    'ready', v_pool >= c.exam_size * 2, 'review_overdue', public.skillfirms_review_overdue(c), 'last_reviewed_at', c.last_reviewed_at,
    'next_try_at', case when v_next > now() then v_next end,
    'last', case when v_last.id is null then null else jsonb_build_object('id', v_last.id, 'status', v_last.status,
      'ends_at', v_last.ends_at, 'submitted_at', v_last.submitted_at, 'result_due_at', v_last.result_due_at, 'note', v_last.mark_note,
      'score_pct', case when v_last.status in ('passed', 'failed') then
        round(100.0 * (coalesce(v_last.mcq_points, 0) + coalesce(v_last.written_points, 0)) / greatest(coalesce(v_last.mcq_max, 0) + coalesce(v_last.written_max, 0), 1)) end) end);
end;
$$;
grant execute on function public.skillfirms_exam_info(uuid) to anon, authenticated;

create or replace function public.skillfirms_start_exam(p_course uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.skillfirms_courses; v_ids uuid[]; v uuid; v_last public.skillfirms_exam_attempts;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select * into c from public.skillfirms_courses where id = p_course and status = 'published';
  if c.id is null or c.exam_size is null then raise exception 'no_exam'; end if;
  if public.skillfirms_review_overdue(c) then raise exception 'review_due: this course is waiting for its yearly check by the tutor, so exams are paused'; end if;
  if not exists (select 1 from public.skillfirms_enrollments where user_id = auth.uid() and course_id = c.id) then raise exception 'enroll_first: start the course first'; end if;
  if not public.skillfirms_can_open_course(c.id) then raise exception 'buy_first: get the course to take its exam'; end if;
  perform public._skillfirms_close_expired(auth.uid(), c.id);
  select * into v_last from public.skillfirms_exam_attempts where user_id = auth.uid() and course_id = c.id order by started_at desc limit 1;
  if v_last.status = 'in_progress' then return v_last.id; end if;
  if v_last.status = 'passed' then raise exception 'already_passed'; end if;
  if v_last.status = 'marking' then raise exception 'marking: your last exam is being marked'; end if;
  if v_last.status = 'failed' and greatest(v_last.marked_at, v_last.submitted_at) + interval '7 days' > now() then
    raise exception 'wait: you can try again 7 days after your last result'; end if;
  select array_agg(id) into v_ids from (
    select id from public.skillfirms_exam_questions where course_id = c.id and retired_at is null order by random() limit c.exam_size) t;
  if coalesce(array_length(v_ids, 1), 0) < c.exam_size then raise exception 'not_ready: this exam isn''t ready yet'; end if;
  insert into public.skillfirms_exam_attempts (course_id, user_id, question_ids, ends_at)
  values (c.id, auth.uid(), v_ids, now() + make_interval(mins => c.exam_minutes)) returning id into v;
  return v;
end;
$$;
grant execute on function public.skillfirms_start_exam(uuid) to authenticated;

create or replace function public.skillfirms_exam_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.skillfirms_exam_attempts;
begin
  select * into a from public.skillfirms_exam_attempts where id = p_attempt and user_id = auth.uid();
  if a.id is null then return null; end if;
  if a.status = 'in_progress' and now() > a.ends_at + interval '2 minutes' then
    perform public._skillfirms_close_exam(a.id, null, null);
    select * into a from public.skillfirms_exam_attempts where id = p_attempt;
  end if;
  return jsonb_build_object('id', a.id, 'course_id', a.course_id, 'status', a.status, 'ends_at', a.ends_at, 'now', now(),
    'answers', case when a.status = 'in_progress' then a.answers end,
    -- Questions in this attempt's own random order; never the right answers.
    'questions', case when a.status = 'in_progress' then (select jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'question', q.question,
        'choices', q.choices, 'points', q.points) order by array_position(a.question_ids, q.id))
      from public.skillfirms_exam_questions q where q.id = any(a.question_ids)) end);
end;
$$;
grant execute on function public.skillfirms_exam_attempt(uuid) to authenticated;

create or replace function public.skillfirms_save_exam_answers(p_attempt uuid, p_answers jsonb, p_signals jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.skillfirms_exam_attempts set answers = coalesce(p_answers, '{}'), signals = coalesce(p_signals, signals)
  where id = p_attempt and user_id = auth.uid() and status = 'in_progress' and now() <= ends_at + interval '2 minutes'
    and pg_column_size(p_answers) < 400000;
end;
$$;
grant execute on function public.skillfirms_save_exam_answers(uuid, jsonb, jsonb) to authenticated;

create or replace function public.skillfirms_submit_exam(p_attempt uuid, p_answers jsonb, p_signals jsonb)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.skillfirms_exam_attempts where id = p_attempt and user_id = auth.uid()) then raise exception 'not_yours'; end if;
  if pg_column_size(p_answers) >= 400000 then raise exception 'too_long'; end if;
  perform public._skillfirms_close_exam(p_attempt, p_answers, p_signals);
  return (select status from public.skillfirms_exam_attempts where id = p_attempt);
end;
$$;
grant execute on function public.skillfirms_submit_exam(uuid, jsonb, jsonb) to authenticated;

-- ---------- Tutor: marking ----------

create or replace function public.skillfirms_exam_marking_queue()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'course', jsonb_build_object('id', c.id, 'title', c.title, 'pass_pct', c.exam_pass_pct),
    'learner', coalesce(p.display_name, p.username), 'submitted_at', a.submitted_at, 'result_due_at', a.result_due_at,
    'mcq_points', a.mcq_points, 'mcq_max', a.mcq_max, 'written_max', a.written_max, 'flags', a.flags,
    'written', (select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'model_answer', q.model_answer, 'points', q.points,
        'answer', a.answers->>q.id::text) order by array_position(a.question_ids, q.id))
      from public.skillfirms_exam_questions q where q.id = any(a.question_ids) and q.kind = 'written')
  ) order by a.submitted_at), '[]')
  from public.skillfirms_exam_attempts a
  join public.skillfirms_courses c on c.id = a.course_id
  join public.profiles p on p.id = a.user_id
  where a.status = 'marking'
    and (exists (select 1 from public.skillfirms_experts e where e.id = c.expert_id and e.profile_id = auth.uid()) or public.skillfirms_is_admin());
$$;
grant execute on function public.skillfirms_exam_marking_queue() to authenticated;

create or replace function public.skillfirms_mark_exam(p_attempt uuid, p_marks jsonb, p_note text)
returns text language plpgsql security definer set search_path = public as $$
declare a public.skillfirms_exam_attempts; c public.skillfirms_courses; v_points int := 0; q record; v_status text;
begin
  select * into a from public.skillfirms_exam_attempts where id = p_attempt for update;
  if a.id is null or not public._skillfirms_course_tutor(a.course_id) then raise exception 'not_yours'; end if;
  if a.status <> 'marking' then raise exception 'not_waiting'; end if;
  select * into c from public.skillfirms_courses where id = a.course_id;
  for q in select * from public.skillfirms_exam_questions where id = any(a.question_ids) and kind = 'written' loop
    if not ((p_marks->>q.id::text) ~ '^\d+$') then raise exception 'mark_all: give points for every written answer'; end if;
    v_points := v_points + least(greatest((p_marks->>q.id::text)::int, 0), q.points);
  end loop;
  v_status := case when (coalesce(a.mcq_points, 0) + v_points) * 100 >= c.exam_pass_pct * greatest(coalesce(a.mcq_max, 0) + coalesce(a.written_max, 0), 1)
                   then 'passed' else 'failed' end;
  update public.skillfirms_exam_attempts set written_points = v_points, marks = p_marks, status = v_status, marked_at = now(),
    mark_note = nullif(left(btrim(coalesce(p_note, '')), 3000), '') where id = a.id;
  if v_status = 'passed' then perform public._skillfirms_maybe_certify(a.user_id, a.course_id); end if;
  return v_status;
end;
$$;
grant execute on function public.skillfirms_mark_exam(uuid, jsonb, text) to authenticated;

-- ---------- Projects: monthly spots and peer review ----------

select public._edit_fn('public.skillfirms_start_course_project(uuid)'::regprocedure, array[array[
  $a$  insert into public.skillfirms_course_projects (course_id, user_id, due_at)$a$,
  $b$  if c.project_monthly_spots is not null
     and not exists (select 1 from public.skillfirms_course_projects where course_id = p_course and user_id = auth.uid())
     and (select count(*) from public.skillfirms_course_projects where course_id = p_course and started_at >= date_trunc('month', now())) >= c.project_monthly_spots then
    raise exception 'full: this month''s project spots are taken; new spots open on the 1st';
  end if;
  insert into public.skillfirms_course_projects (course_id, user_id, due_at)$b$]]);

-- Projects other certified learners of the course can review now.
create or replace function public.skillfirms_peer_project_queue()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'course', jsonb_build_object('title', c.title, 'slug', c.slug, 'brief', c.project_brief),
    'submitted_at', p.submitted_at, 'work_url', p.work_url, 'notes', p.notes) order by p.submitted_at), '[]')
  from public.skillfirms_course_projects p
  join public.skillfirms_courses c on c.id = p.course_id and c.project_review = 'peer'
  where p.status = 'submitted' and p.user_id <> auth.uid()
    and exists (select 1 from public.skillfirms_credentials k where k.user_id = auth.uid() and k.course_id = c.id and k.status = 'active_verified')
    and not exists (select 1 from public.skillfirms_project_peer_reviews r where r.project_id = p.id and r.reviewer_id = auth.uid())
    and (select count(*) from public.skillfirms_project_peer_reviews r where r.project_id = p.id) < 2;
$$;
grant execute on function public.skillfirms_peer_project_queue() to authenticated;

create or replace function public.skillfirms_peer_review_project(p_id uuid, p_pass boolean, p_note text)
returns text language plpgsql security definer set search_path = public as $$
declare p public.skillfirms_course_projects; c public.skillfirms_courses; v_pass int; v_fail int; v_notes text;
begin
  select * into p from public.skillfirms_course_projects where id = p_id for update;
  if p.id is null or p.status <> 'submitted' then raise exception 'not_waiting'; end if;
  if p.user_id = auth.uid() then raise exception 'not_your_own'; end if;
  select * into c from public.skillfirms_courses where id = p.course_id;
  if c.project_review <> 'peer' or not exists (select 1 from public.skillfirms_credentials k
       where k.user_id = auth.uid() and k.course_id = c.id and k.status = 'active_verified') then
    raise exception 'certified_only: only people who hold this course''s certificate can review its projects'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 10 then raise exception 'note: tell them what you saw (10+ characters)'; end if;
  if exists (select 1 from public.skillfirms_project_peer_reviews where project_id = p.id and reviewer_id = auth.uid()) then
    raise exception 'already_reviewed: you already reviewed this project'; end if;
  insert into public.skillfirms_project_peer_reviews (project_id, reviewer_id, pass, note) values (p.id, auth.uid(), p_pass, left(btrim(p_note), 3000));
  select count(*) filter (where pass), count(*) filter (where not pass), string_agg(note, E'\n\n' order by created_at)
    into v_pass, v_fail, v_notes from public.skillfirms_project_peer_reviews where project_id = p.id;
  if v_pass = 2 then
    update public.skillfirms_course_projects set status = 'passed', review_note = v_notes, reviewed_at = now() where id = p.id;
    perform public._skillfirms_maybe_certify(p.user_id, p.course_id);
    return 'passed';
  elsif v_fail = 2 then
    update public.skillfirms_course_projects set status = 'needs_work', review_note = v_notes, reviewed_at = now(),
      due_at = now() + make_interval(days => c.project_days) where id = p.id;
    return 'needs_work';
  end if;
  return case when v_pass + v_fail = 2 then 'tutor' else 'waiting' end;  -- split: the tutor decides
end;
$$;
grant execute on function public.skillfirms_peer_review_project(uuid, boolean, text) to authenticated;

-- The tutor's project list now also shows peer reviews so far.
create or replace function public.skillfirms_project_reviews()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'course', jsonb_build_object('title', c.title, 'slug', c.slug),
    'learner', coalesce(pr.display_name, pr.username), 'submitted_at', p.submitted_at, 'due_at', p.due_at,
    'work_url', p.work_url, 'notes', p.notes, 'peer_mode', c.project_review = 'peer',
    'peer_reviews', (select coalesce(jsonb_agg(jsonb_build_object('pass', r.pass, 'note', r.note) order by r.created_at), '[]')
                     from public.skillfirms_project_peer_reviews r where r.project_id = p.id)) order by p.submitted_at), '[]'::jsonb)
  from public.skillfirms_course_projects p
  join public.skillfirms_courses c on c.id = p.course_id
  join public.skillfirms_experts e on e.id = c.expert_id and e.profile_id = auth.uid()
  join public.profiles pr on pr.id = p.user_id
  where p.status = 'submitted';
$$;

-- ---------- Certificates ----------

create or replace function public._skillfirms_maybe_certify(p_user uuid, p_course uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.skillfirms_courses; v_enr uuid; v_total int; v_done int; v_failed int; v_checks_ok boolean; v_project_ok boolean;
begin
  select * into c from public.skillfirms_courses where id = p_course;
  if c.id is null or c.taught_by = 'ai' then return null; end if;
  -- Past its yearly check, a course issues no new certificates (they are
  -- issued once the tutor confirms it again).
  if public.skillfirms_review_overdue(c) then return null; end if;
  select id into v_enr from public.skillfirms_enrollments where user_id = p_user and course_id = p_course;
  if v_enr is null then return null; end if;
  if c.exam_size is not null then
    -- A course with a final exam certifies on the exam, not the lesson checks.
    v_checks_ok := exists (select 1 from public.skillfirms_exam_attempts where user_id = p_user and course_id = p_course and status = 'passed');
  else
    select count(*) into v_total from public.skillfirms_course_modules where course_id = p_course;
    select count(*) into v_done from public.skillfirms_module_progress p join public.skillfirms_course_modules m on m.id = p.module_id
      where p.enrollment_id = v_enr and m.course_id = p_course and p.completed_at is not null;
    select count(*) into v_failed from public.skillfirms_course_modules m
      where m.course_id = p_course
        and exists (select 1 from public.skillfirms_module_quiz_questions q where q.module_id = m.id)
        and not exists (select 1 from public.skillfirms_module_progress p where p.enrollment_id = v_enr and p.module_id = m.id and p.quiz_score >= 0.66);
    v_checks_ok := v_done >= v_total and v_failed = 0;
  end if;
  v_project_ok := exists (select 1 from public.skillfirms_course_projects where course_id = p_course and user_id = p_user and status = 'passed');
  if (c.certificate_rule = 'checks' and v_checks_ok)
     or (c.certificate_rule = 'project' and v_project_ok)
     or (c.certificate_rule = 'both' and v_checks_ok and v_project_ok) then
    return public.skillfirms_issue_or_update_credential(p_user, c.title, 'assessment_based', p_course, null,
      coalesce((select assessment_version from public.skillfirms_course_modules where course_id = p_course order by order_index limit 1), 'v1'));
  end if;
  return null;
end;
$$;

-- ---------- Sending a course for review ----------
-- With a final exam, lessons no longer each need their own graded
-- questions (they stay as optional practice); the pool must be at least
-- twice the exam's size.
select public._edit_fn('public.skillfirms_studio_submit(uuid)'::regprocedure, array[array[
  $a$  if v_c.certificate_rule in ('checks', 'both') and exists (select 1 from public.skillfirms_course_modules m where m.course_id = v_c.id$a$,
  $b$  if v_c.certificate_rule in ('checks', 'both') and v_c.exam_size is not null
     and (select count(*) from public.skillfirms_exam_questions where course_id = v_c.id and retired_at is null) < v_c.exam_size * 2 then
    raise exception 'needs_exam_pool: write at least twice as many exam questions as each exam shows'; end if;
  if v_c.certificate_rule in ('checks', 'both') and v_c.exam_size is null and exists (select 1 from public.skillfirms_course_modules m where m.course_id = v_c.id$b$]]);

grant execute on function public.skillfirms_studio_exam(uuid) to authenticated;
grant execute on function public.skillfirms_studio_save_exam_question(uuid, uuid, text, text, jsonb, int, text, int) to authenticated;
grant execute on function public.skillfirms_studio_retire_exam_question(uuid) to authenticated;
grant execute on function public.skillfirms_studio_set_exam(uuid, int, int, int, text, int) to authenticated;
grant execute on function public.skillfirms_confirm_course_review(uuid) to authenticated;
revoke execute on function public.skillfirms_studio_exam(uuid), public.skillfirms_studio_save_exam_question(uuid, uuid, text, text, jsonb, int, text, int),
  public.skillfirms_studio_retire_exam_question(uuid), public.skillfirms_studio_set_exam(uuid, int, int, int, text, int),
  public.skillfirms_confirm_course_review(uuid), public.skillfirms_start_exam(uuid), public.skillfirms_exam_attempt(uuid),
  public.skillfirms_save_exam_answers(uuid, jsonb, jsonb), public.skillfirms_submit_exam(uuid, jsonb, jsonb),
  public.skillfirms_exam_marking_queue(), public.skillfirms_mark_exam(uuid, jsonb, text),
  public.skillfirms_peer_project_queue(), public.skillfirms_peer_review_project(uuid, boolean, text) from public, anon;
