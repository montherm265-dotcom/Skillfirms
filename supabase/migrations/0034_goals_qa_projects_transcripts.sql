-- 0034: weekly learning goal, lesson Q&A, career-path projects with peer
-- review, and video transcripts. (Instructor pages read existing tables.)

-- 1. Weekly goal ------------------------------------------------------------------------
create table if not exists public.skillfirms_learning_goals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  days_per_week int not null check (days_per_week between 1 and 7),
  updated_at timestamptz not null default now()
);
alter table public.skillfirms_learning_goals enable row level security;
drop policy if exists "my goal" on public.skillfirms_learning_goals;
create policy "my goal" on public.skillfirms_learning_goals for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.skillfirms_learning_goals to authenticated;

-- One row per day you learned (opened a lesson or passed a check).
create table if not exists public.skillfirms_learning_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.skillfirms_learning_days enable row level security;
drop policy if exists "my days" on public.skillfirms_learning_days;
create policy "my days" on public.skillfirms_learning_days for select using (user_id = (select auth.uid()));
grant select on public.skillfirms_learning_days to authenticated;

create or replace function public.skillfirms_log_learning_day()
returns void language sql security definer set search_path = public as $$
  insert into public.skillfirms_learning_days (user_id, day)
  select auth.uid(), (now() at time zone 'utc')::date where auth.uid() is not null
  on conflict do nothing;
$$;
revoke all on function public.skillfirms_log_learning_day() from public, anon;
grant execute on function public.skillfirms_log_learning_day() to authenticated;

-- This week (Monday first), the goal, and how many weeks in a row it was met.
create or replace function public.skillfirms_my_week()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_goal int;
  v_monday date := date_trunc('week', (now() at time zone 'utc'))::date;
  v_streak int := 0;
  v_w date;
begin
  if auth.uid() is null then return null; end if;
  select days_per_week into v_goal from public.skillfirms_learning_goals where user_id = auth.uid();
  if v_goal is not null then
    v_w := v_monday - 7;
    loop
      exit when (select count(*) from public.skillfirms_learning_days where user_id = auth.uid() and day >= v_w and day < v_w + 7) < v_goal;
      v_streak := v_streak + 1;
      v_w := v_w - 7;
      exit when v_streak > 520;
    end loop;
    if (select count(*) from public.skillfirms_learning_days where user_id = auth.uid() and day >= v_monday) >= v_goal then v_streak := v_streak + 1; end if;
  end if;
  return jsonb_build_object(
    'goal', v_goal,
    'monday', v_monday,
    'today', (now() at time zone 'utc')::date,
    'days', (select coalesce(jsonb_agg(day order by day), '[]'::jsonb) from public.skillfirms_learning_days where user_id = auth.uid() and day >= v_monday),
    'weeks_in_a_row', v_streak,
    'total_days', (select count(*) from public.skillfirms_learning_days where user_id = auth.uid())
  );
end;
$$;
revoke all on function public.skillfirms_my_week() from public, anon;
grant execute on function public.skillfirms_my_week() to authenticated;

-- 2. Lesson Q&A ---------------------------------------------------------------------------
create table if not exists public.skillfirms_lesson_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.skillfirms_course_modules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 5 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists skillfirms_lesson_questions_module_idx on public.skillfirms_lesson_questions (module_id, created_at desc);
create table if not exists public.skillfirms_lesson_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.skillfirms_lesson_questions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  kind text not null default 'person' check (kind in ('person', 'ai')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists skillfirms_lesson_answers_q_idx on public.skillfirms_lesson_answers (question_id, created_at);
create table if not exists public.skillfirms_answer_votes (
  answer_id uuid not null references public.skillfirms_lesson_answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (answer_id, user_id)
);
alter table public.skillfirms_lesson_questions enable row level security;
alter table public.skillfirms_lesson_answers enable row level security;
alter table public.skillfirms_answer_votes enable row level security;
revoke insert, update, delete on public.skillfirms_lesson_questions, public.skillfirms_lesson_answers, public.skillfirms_answer_votes from anon, authenticated;

-- A lesson's thread: questions, answers (expert answers marked, AI marked),
-- helpful counts, newest questions first.
create or replace function public.skillfirms_lesson_thread(p_module_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with course as (
    select c.id, c.status, e.profile_id as expert_profile
    from public.skillfirms_course_modules m join public.skillfirms_courses c on c.id = m.course_id
    left join public.skillfirms_experts e on e.id = c.expert_id and c.taught_by = 'expert'
    where m.id = p_module_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'body', q.body, 'created_at', q.created_at, 'mine', q.user_id = auth.uid(),
      'author', coalesce(p.display_name, 'A learner'),
      'answers', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id, 'body', a.body, 'kind', a.kind, 'created_at', a.created_at, 'mine', a.user_id = auth.uid(),
          'author', case when a.kind = 'ai' then 'AI tutor' else coalesce(ap.display_name, 'A learner') end,
          'instructor', a.user_id = (select expert_profile from course),
          'helpful', (select count(*) from public.skillfirms_answer_votes v where v.answer_id = a.id),
          'voted', exists (select 1 from public.skillfirms_answer_votes v where v.answer_id = a.id and v.user_id = auth.uid()))
        order by (a.user_id = (select expert_profile from course)) desc, (select count(*) from public.skillfirms_answer_votes v where v.answer_id = a.id) desc, a.created_at), '[]'::jsonb)
        from public.skillfirms_lesson_answers a left join public.profiles ap on ap.id = a.user_id where a.question_id = q.id)
    ) order by q.created_at desc), '[]'::jsonb)
  from public.skillfirms_lesson_questions q
  left join public.profiles p on p.id = q.user_id
  where q.module_id = p_module_id and (select status from course) = 'published';
$$;
revoke all on function public.skillfirms_lesson_thread(uuid) from public;
grant execute on function public.skillfirms_lesson_thread(uuid) to anon, authenticated;

create or replace function public.skillfirms_ask_question(p_module_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'sign_in: sign in to ask'; end if;
  if char_length(btrim(coalesce(p_body, ''))) < 5 then raise exception 'too_short: ask in a few more words'; end if;
  if not exists (select 1 from public.skillfirms_course_modules m join public.skillfirms_courses c on c.id = m.course_id where m.id = p_module_id and c.status = 'published') then
    raise exception 'not_found'; end if;
  if (select count(*) from public.skillfirms_lesson_questions where user_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'slow_down: up to 20 questions a day'; end if;
  insert into public.skillfirms_lesson_questions (module_id, user_id, body) values (p_module_id, auth.uid(), left(btrim(p_body), 2000)) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.skillfirms_ask_question(uuid, text) from public, anon;
grant execute on function public.skillfirms_ask_question(uuid, text) to authenticated;

-- People answer; the asker can attach the AI tutor's answer to their own question.
create or replace function public.skillfirms_answer_question(p_question_id uuid, p_body text, p_ai boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_asker uuid;
begin
  if auth.uid() is null then raise exception 'sign_in: sign in to answer'; end if;
  select user_id into v_asker from public.skillfirms_lesson_questions where id = p_question_id;
  if v_asker is null then raise exception 'not_found'; end if;
  if p_ai and v_asker <> auth.uid() then raise exception 'not_yours'; end if;
  if p_ai and exists (select 1 from public.skillfirms_lesson_answers where question_id = p_question_id and kind = 'ai') then return null; end if;
  if char_length(btrim(coalesce(p_body, ''))) < 1 then raise exception 'empty'; end if;
  if not p_ai and (select count(*) from public.skillfirms_lesson_answers where user_id = auth.uid() and created_at > now() - interval '1 day') >= 50 then
    raise exception 'slow_down: up to 50 answers a day'; end if;
  insert into public.skillfirms_lesson_answers (question_id, user_id, kind, body)
  values (p_question_id, case when p_ai then null else auth.uid() end, case when p_ai then 'ai' else 'person' end, left(btrim(p_body), 4000))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.skillfirms_answer_question(uuid, text, boolean) from public, anon;
grant execute on function public.skillfirms_answer_question(uuid, text, boolean) to authenticated;

create or replace function public.skillfirms_vote_answer(p_answer_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign_in'; end if;
  if p_on then
    insert into public.skillfirms_answer_votes (answer_id, user_id)
    select p_answer_id, auth.uid() where exists (select 1 from public.skillfirms_lesson_answers where id = p_answer_id and user_id is distinct from auth.uid())
    on conflict do nothing;
  else
    delete from public.skillfirms_answer_votes where answer_id = p_answer_id and user_id = auth.uid();
  end if;
end;
$$;
revoke all on function public.skillfirms_vote_answer(uuid, boolean) from public, anon;
grant execute on function public.skillfirms_vote_answer(uuid, boolean) to authenticated;

-- 3. Career-path projects, reviewed by peers -------------------------------------------------
create table if not exists public.skillfirms_path_projects (
  role_id uuid primary key references public.skillfirms_career_roles(id) on delete cascade,
  title text not null,
  brief text not null,
  deliverables jsonb not null default '[]',
  rubric jsonb not null default '[]'
);
alter table public.skillfirms_path_projects enable row level security;
drop policy if exists "projects are public" on public.skillfirms_path_projects;
create policy "projects are public" on public.skillfirms_path_projects for select using (true);
grant select on public.skillfirms_path_projects to anon, authenticated;

create table if not exists public.skillfirms_project_submissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.skillfirms_career_roles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary text not null check (char_length(summary) between 50 and 6000),
  link text check (link is null or (link ~ '^https://' and char_length(link) <= 500)),
  status text not null default 'in_review' check (status in ('in_review', 'passed', 'needs_work')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists skillfirms_one_open_submission on public.skillfirms_project_submissions (role_id, user_id) where status = 'in_review';
create table if not exists public.skillfirms_project_reviews (
  submission_id uuid not null references public.skillfirms_project_submissions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  scores jsonb not null default '{}',
  verdict text not null check (verdict in ('pass', 'needs_work')),
  comment text not null check (char_length(comment) between 20 and 3000),
  created_at timestamptz not null default now(),
  primary key (submission_id, reviewer_id)
);
alter table public.skillfirms_project_submissions enable row level security;
alter table public.skillfirms_project_reviews enable row level security;
revoke insert, update, delete on public.skillfirms_project_submissions, public.skillfirms_project_reviews from anon, authenticated;

create or replace function public.skillfirms_submit_project(p_role_id uuid, p_summary text, p_link text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'sign_in'; end if;
  if not exists (select 1 from public.skillfirms_path_projects where role_id = p_role_id) then raise exception 'not_found'; end if;
  if exists (select 1 from public.skillfirms_project_submissions where role_id = p_role_id and user_id = auth.uid() and status in ('in_review', 'passed')) then
    raise exception 'already_submitted: you already have a submission for this path'; end if;
  if char_length(btrim(coalesce(p_summary, ''))) < 50 then raise exception 'too_short: describe what you did in at least 50 characters'; end if;
  insert into public.skillfirms_project_submissions (role_id, user_id, summary, link)
  values (p_role_id, auth.uid(), left(btrim(p_summary), 6000), nullif(btrim(coalesce(p_link, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.skillfirms_submit_project(uuid, text, text) from public, anon;
grant execute on function public.skillfirms_submit_project(uuid, text, text) to authenticated;

-- Reviewers: anyone who passed a project on this path, or has passed at least
-- one lesson check, but never their own work, and once per submission. Two
-- "pass" reviews pass it; two "needs work" send it back with the comments.
create or replace function public.skillfirms_review_project(p_submission_id uuid, p_verdict text, p_comment text, p_scores jsonb default '{}')
returns text language plpgsql security definer set search_path = public as $$
declare v_sub public.skillfirms_project_submissions; v_pass int; v_fail int;
begin
  if auth.uid() is null then raise exception 'sign_in'; end if;
  select * into v_sub from public.skillfirms_project_submissions where id = p_submission_id;
  if v_sub.id is null or v_sub.status <> 'in_review' then raise exception 'not_open'; end if;
  if v_sub.user_id = auth.uid() then raise exception 'own_work: you can''t review your own project'; end if;
  if not exists (select 1 from public.skillfirms_module_progress mp join public.skillfirms_enrollments e on e.id = mp.enrollment_id where e.user_id = auth.uid() and mp.completed_at is not null) then
    raise exception 'not_yet: pass at least one lesson check before reviewing'; end if;
  if p_verdict not in ('pass', 'needs_work') then raise exception 'bad_verdict'; end if;
  if char_length(btrim(coalesce(p_comment, ''))) < 20 then raise exception 'too_short: say what works and what to improve (20+ characters)'; end if;
  insert into public.skillfirms_project_reviews (submission_id, reviewer_id, scores, verdict, comment)
  values (p_submission_id, auth.uid(), coalesce(p_scores, '{}'), p_verdict, left(btrim(p_comment), 3000));
  select count(*) filter (where verdict = 'pass'), count(*) filter (where verdict = 'needs_work') into v_pass, v_fail
  from public.skillfirms_project_reviews where submission_id = p_submission_id;
  if v_pass >= 2 then update public.skillfirms_project_submissions set status = 'passed', decided_at = now() where id = p_submission_id; return 'passed'; end if;
  if v_fail >= 2 then update public.skillfirms_project_submissions set status = 'needs_work', decided_at = now() where id = p_submission_id; return 'needs_work'; end if;
  return 'in_review';
end;
$$;
revoke all on function public.skillfirms_review_project(uuid, text, text, jsonb) from public, anon;
grant execute on function public.skillfirms_review_project(uuid, text, text, jsonb) to authenticated;

-- Everything the path page needs: the project, my submission and its
-- reviews, and up to 5 others' submissions waiting for a review.
create or replace function public.skillfirms_path_project(p_role_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'project', (select to_jsonb(pp) - 'role_id' from public.skillfirms_path_projects pp where pp.role_id = p_role_id),
    'passed_count', (select count(*) from public.skillfirms_project_submissions where role_id = p_role_id and status = 'passed'),
    'mine', (select jsonb_build_object('id', s.id, 'status', s.status, 'summary', s.summary, 'link', s.link, 'created_at', s.created_at,
               'reviews', (select coalesce(jsonb_agg(jsonb_build_object('verdict', r.verdict, 'comment', r.comment, 'scores', r.scores, 'created_at', r.created_at) order by r.created_at), '[]'::jsonb)
                           from public.skillfirms_project_reviews r where r.submission_id = s.id))
             from public.skillfirms_project_submissions s where s.role_id = p_role_id and s.user_id = auth.uid() order by s.created_at desc limit 1),
    'to_review', case when auth.uid() is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('id', s.id, 'summary', s.summary, 'link', s.link, 'created_at', s.created_at,
                 'reviews', (select count(*) from public.skillfirms_project_reviews r where r.submission_id = s.id)) as x
        from public.skillfirms_project_submissions s
        where s.role_id = p_role_id and s.status = 'in_review' and s.user_id <> auth.uid()
          and not exists (select 1 from public.skillfirms_project_reviews r where r.submission_id = s.id and r.reviewer_id = auth.uid())
        order by s.created_at limit 5) t) end
  );
$$;
revoke all on function public.skillfirms_path_project(uuid) from public;
grant execute on function public.skillfirms_path_project(uuid) to anon, authenticated;

insert into public.skillfirms_path_projects (role_id, title, brief, deliverables, rubric)
select r.id, v.title, v.brief, v.deliverables::jsonb, v.rubric::jsonb
from (values
  ('cqv_engineer', 'Qualify a cold room', 'A site is installing a 2-8 °C cold room for finished product. Write the qualification approach as if you were the CQV engineer on the project.', '["A one-page qualification plan: scope, IQ/OQ/PQ split, who approves what", "Five OQ test cases with acceptance criteria", "A temperature-mapping approach for PQ (probe count, placement, duration)", "Two risks you would raise early, and how you would control them"]', '["Scope and approach are clear", "Acceptance criteria are measurable", "Mapping approach is justified", "Risks are real and controlled"]'),
  ('cqv_lead', 'Plan the CQV for a new filling line', 'You lead CQV for a new aseptic filling line. Plan the work for your team and the client.', '["A CQV plan: phases, deliverables and approvals", "A resourcing table: roles, people, weeks", "A critical-path schedule summary with three key milestones", "How you will report status and escalate issues"]', '["Plan covers the full lifecycle", "Resourcing is realistic", "Schedule logic holds", "Reporting and escalation are clear"]'),
  ('cqv_manager', 'Recover a late CQV programme', 'A CQV programme is six weeks behind and over budget. Write the recovery plan you would present to the site director.', '["A one-page diagnosis: why it is late", "A recovery plan with options and their cost", "Changes to scope, team or sequence you recommend", "How you will rebuild trust with the client"]', '["Diagnosis is evidence-based", "Options are costed", "Recommendations are specific", "Stakeholder plan is credible"]'),
  ('senior_cqv_engineer', 'Write a risk-based commissioning strategy', 'Write the commissioning and qualification strategy for a new purified water system, using a risk-based approach.', '["System boundaries and critical aspects", "Which tests are commissioning, which are qualification, and why", "A traceability approach from requirements to tests", "How you will mentor a junior engineer through execution"]', '["Critical aspects are justified", "Leverage of commissioning is sound", "Traceability is complete", "Mentoring plan is practical"]'),
  ('data_analyst', 'Answer a business question with data', 'Pick a public dataset (for example a city open-data portal) and answer one real question a manager would ask.', '["The question, and why it matters", "Your SQL or notebook, linked", "Two charts that answer it", "A five-sentence summary with one recommendation"]', '["Question is clear and useful", "Method is correct", "Charts are honest and readable", "Recommendation follows from the data"]'),
  ('ai_engineer', 'Ship a small ML model', 'Train and ship a small model end to end on a public dataset, and explain how you would run it in production.', '["Repository link with training and evaluation code", "Your metric, baseline and result", "How it is served (API or batch) and monitored", "One failure mode and how you would catch it"]', '["Code runs and is clear", "Evaluation is honest", "Serving plan is realistic", "Monitoring covers real risks"]'),
  ('mechanical_engineer', 'Size a ventilation fan', 'Size the supply fan for a small workshop and document your calculation as you would for a design review.', '["Design basis: space, occupancy, air changes", "Your calculation (airflow and pressure) with assumptions", "Fan selection with a reason", "Two checks a reviewer should make"]', '["Design basis is complete", "Calculation is correct", "Selection is justified", "Review checks are meaningful"]'),
  ('project_engineer', 'Plan a small retrofit', 'Plan the retrofit of a pump skid in a running plant: scope, schedule, interfaces and risks.', '["Scope and exclusions", "A schedule with shutdown window", "Interfaces with operations, safety and vendors", "Top five risks with owners"]', '["Scope is unambiguous", "Schedule respects operations", "Interfaces are covered", "Risks have owners and actions"]'),
  ('project_manager', 'Turn around a slipping project', 'A software or construction project of your choice is slipping. Write the plan you would take to the sponsor.', '["Current status in one page (scope, time, cost)", "Root causes", "A re-baselined plan with trade-offs", "Communication plan for the next four weeks"]', '["Status is honest", "Root causes are real", "Trade-offs are explicit", "Communication is specific"]'),
  ('product_manager', 'Write a one-page product bet', 'Pick a product you use. Find one problem worth solving and write the bet you would pitch to your team.', '["The user problem and evidence for it", "The proposed solution and what you would not build", "How you will measure success", "The smallest version you would ship first"]', '["Problem is evidenced", "Scope is focused", "Metrics are meaningful", "First version is truly small"]')
) as v(slug, title, brief, deliverables, rubric)
join public.skillfirms_career_roles r on r.slug = v.slug
on conflict (role_id) do update set title = excluded.title, brief = excluded.brief, deliverables = excluded.deliverables, rubric = excluded.rubric;

-- 4. Video transcripts: experts can add one per lesson (kept in the lesson body).
create or replace function public.skillfirms_set_transcript(p_module_id uuid, p_transcript text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.skillfirms_course_modules m join public.skillfirms_courses c on c.id = m.course_id
                 join public.skillfirms_experts e on e.id = c.expert_id
                 where m.id = p_module_id and (e.profile_id = auth.uid() or public.skillfirms_is_admin())) then
    raise exception 'not_yours'; end if;
  update public.skillfirms_lessons
  set body = case when nullif(btrim(coalesce(p_transcript, '')), '') is null then body - 'transcript'
                  else coalesce(body, '{}'::jsonb) || jsonb_build_object('transcript', left(btrim(p_transcript), 60000)) end
  where module_id = p_module_id;
end;
$$;
revoke all on function public.skillfirms_set_transcript(uuid, text) from public, anon;
grant execute on function public.skillfirms_set_transcript(uuid, text) to authenticated;

-- The course editor keeps the transcript when it saves a lesson.
create or replace function public.skillfirms_studio_course(p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.skillfirms_courses := public._skillfirms_my_course(p_course_id);
begin
  if v_c.id is null then raise exception 'not_yours'; end if;
  return jsonb_build_object(
    'id', v_c.id, 'title', v_c.title, 'description', v_c.description, 'level', v_c.level, 'price_cents', v_c.price_cents,
    'status', v_c.status, 'review_state', v_c.review_state, 'review_note', v_c.review_note, 'slug', v_c.slug,
    'skill_ids', (select coalesce(jsonb_agg(skill_id), '[]') from public.skillfirms_course_skills where course_id = v_c.id),
    'lessons', (select coalesce(jsonb_agg(jsonb_build_object(
        'title', m.title, 'duration_minutes', m.duration_minutes, 'video_url', m.video_url,
        'summary', l.body->>'summary', 'sections', coalesce(l.body->'sections', '[]'), 'key_points', coalesce(l.body->'key_points', '[]'),
        'transcript', l.body->>'transcript',
        'questions', (select coalesce(jsonb_agg(jsonb_build_object('question', q.question, 'choices', q.choices, 'answer_index', q.correct_index) order by q.order_index), '[]')
                      from public.skillfirms_module_quiz_questions q where q.module_id = m.id)
      ) order by m.order_index), '[]')
      from public.skillfirms_course_modules m left join public.skillfirms_lessons l on l.module_id = m.id where m.course_id = v_c.id));
end;
$$;
revoke all on function public.skillfirms_studio_course(uuid) from public, anon;
grant execute on function public.skillfirms_studio_course(uuid) to authenticated;


create or replace function public.skillfirms_studio_save(p_course_id uuid, p_course jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_expert public.skillfirms_experts := public._skillfirms_my_expert();
  v_c public.skillfirms_courses;
  v_id uuid := p_course_id;
  v_title text := btrim(coalesce(p_course->>'title', ''));
  v_price int := coalesce((p_course->>'price_cents')::int, 0);
  v_lesson jsonb;
  v_q jsonb;
  v_mod uuid;
  v_i int := 0;
  v_j int;
  v_minutes int := 0;
begin
  if v_expert.id is null then raise exception 'experts_only: only approved experts can build courses'; end if;
  if char_length(v_title) < 5 or char_length(v_title) > 120 then raise exception 'title_length: give the course a title of 5-120 characters'; end if;
  if jsonb_array_length(coalesce(p_course->'lessons', '[]')) > 40 then raise exception 'too_many_lessons: up to 40 lessons'; end if;
  if v_id is null then
    insert into public.skillfirms_courses (expert_id, slug, title, description, level, duration_hours, status, taught_by, review_state, price_cents)
    values (v_expert.id,
            trim(both '-' from regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
            v_title, left(p_course->>'description', 4000), coalesce(nullif(p_course->>'level', ''), 'beginner'), 1, 'draft', 'expert', 'draft', v_price)
    returning id into v_id;
  else
    v_c := public._skillfirms_my_course(v_id);
    if v_c.id is null then raise exception 'not_yours'; end if;
    if v_c.status = 'published' then raise exception 'published_locked: a published course can''t be edited here yet'; end if;
    update public.skillfirms_courses set title = v_title, description = left(p_course->>'description', 4000),
      level = coalesce(nullif(p_course->>'level', ''), 'beginner'), price_cents = v_price,
      review_state = case when review_state = 'submitted' then 'draft' else coalesce(review_state, 'draft') end
    where id = v_id;
    delete from public.skillfirms_course_modules where course_id = v_id;
    delete from public.skillfirms_course_skills where course_id = v_id;
  end if;

  insert into public.skillfirms_course_skills (course_id, skill_id, coverage)
  select v_id, s.id, 1.0 from public.skillfirms_skills s
  where s.id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_course->'skill_ids', '[]')) x) limit 6;

  for v_lesson in select * from jsonb_array_elements(coalesce(p_course->'lessons', '[]')) loop
    insert into public.skillfirms_course_modules (course_id, order_index, title, description, duration_minutes, has_quiz, video_url)
    values (v_id, v_i, left(btrim(coalesce(v_lesson->>'title', 'Lesson ' || (v_i + 1))), 200), left(v_lesson->>'summary', 500),
            least(greatest(coalesce((v_lesson->>'duration_minutes')::int, 15), 1), 240), true, nullif(btrim(coalesce(v_lesson->>'video_url', '')), ''))
    returning id into v_mod;
    v_minutes := v_minutes + least(greatest(coalesce((v_lesson->>'duration_minutes')::int, 15), 1), 240);
    insert into public.skillfirms_lessons (module_id, status, body, source, generated_at)
    values (v_mod, 'ready', jsonb_build_object(
      'format', 'expert',
      'summary', coalesce(v_lesson->>'summary', ''),
      'sections', coalesce((select jsonb_agg(jsonb_build_object('heading', left(s->>'heading', 160), 'body', left(s->>'body', 12000)))
                            from jsonb_array_elements(coalesce(v_lesson->'sections', '[]')) s where btrim(coalesce(s->>'body', '')) <> ''), '[]'),
      'key_points', coalesce((select jsonb_agg(left(k #>> '{}', 400)) from jsonb_array_elements(coalesce(v_lesson->'key_points', '[]')) k where btrim(k #>> '{}') <> ''), '[]'),
      'video_url', nullif(btrim(coalesce(v_lesson->>'video_url', '')), ''),
      'transcript', nullif(left(btrim(coalesce(v_lesson->>'transcript', '')), 60000), '')), 'expert_written', now());
    v_j := 0;
    for v_q in select * from jsonb_array_elements(coalesce(v_lesson->'questions', '[]')) loop
      if btrim(coalesce(v_q->>'question', '')) <> '' and jsonb_array_length(coalesce(v_q->'choices', '[]')) between 2 and 6 then
        insert into public.skillfirms_module_quiz_questions (module_id, order_index, question, choices, correct_index)
        values (v_mod, v_j, left(btrim(v_q->>'question'), 400), v_q->'choices',
                least(greatest(coalesce((v_q->>'answer_index')::int, 0), 0), jsonb_array_length(v_q->'choices') - 1));
        v_j := v_j + 1;
      end if;
    end loop;
    v_i := v_i + 1;
  end loop;
  update public.skillfirms_courses set duration_hours = greatest(round(v_minutes / 60.0, 2), 0.1) where id = v_id;
  return v_id;
end;
$$;
revoke all on function public.skillfirms_studio_save(uuid, jsonb) from public, anon;
grant execute on function public.skillfirms_studio_save(uuid, jsonb) to authenticated;

