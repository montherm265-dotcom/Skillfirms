-- 0031: Skillfirms' own plans (Free / Scholar / Mastery) and expert-set
-- time limits on graded checks. Safe to run more than once.
--
-- Plans: every number below is what the server enforces (tutor questions,
-- check tries, expert-course discount, review priority). Talfirms Pro
-- includes Scholar and Talfirms Ultra includes Mastery. Card payments aren't
-- connected yet, so joining a paid plan puts you on the waiting list (no
-- charge) and an admin can switch it on.

-- 1. Plans ------------------------------------------------------------------------------------------
create table if not exists public.skillfirms_plans (
  plan text primary key check (plan in ('free', 'scholar', 'mastery')),
  name text not null,
  monthly_cents integer,
  yearly_cents integer,
  tutor_per_day integer not null,
  check_tries_per_day integer not null,
  expert_discount_pct integer not null default 0 check (expert_discount_pct between 0 and 50),
  priority_review boolean not null default false,
  sort integer not null default 0
);
alter table public.skillfirms_plans enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_plans' and policyname = 'plans are public') then
    create policy "plans are public" on public.skillfirms_plans for select using (true);
  end if;
end $$;
revoke insert, update, delete on public.skillfirms_plans from anon, authenticated;
grant select on public.skillfirms_plans to anon, authenticated;

insert into public.skillfirms_plans (plan, name, monthly_cents, yearly_cents, tutor_per_day, check_tries_per_day, expert_discount_pct, priority_review, sort) values
  ('free', 'Free', 0, 0, 10, 5, 0, false, 0),
  ('scholar', 'Scholar', 599, 5990, 60, 10, 15, false, 1),
  ('mastery', 'Mastery', 1299, 12990, 150, 20, 25, true, 2)
on conflict (plan) do update set name = excluded.name, monthly_cents = excluded.monthly_cents, yearly_cents = excluded.yearly_cents,
  tutor_per_day = excluded.tutor_per_day, check_tries_per_day = excluded.check_tries_per_day,
  expert_discount_pct = excluded.expert_discount_pct, priority_review = excluded.priority_review, sort = excluded.sort;

create table if not exists public.skillfirms_memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('scholar', 'mastery')),
  billing text not null default 'monthly' check (billing in ('monthly', 'yearly')),
  status text not null default 'waitlist' check (status in ('waitlist', 'awaiting_payment', 'active', 'ended')),
  active_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.skillfirms_memberships enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_memberships' and policyname = 'see my membership') then
    create policy "see my membership" on public.skillfirms_memberships for select using (user_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.skillfirms_memberships from anon;
revoke insert, update, delete on public.skillfirms_memberships from authenticated;
grant select on public.skillfirms_memberships to authenticated;

insert into public.app_flags (key, enabled) values ('skillfirms_plan_sales', false) on conflict (key) do nothing;

-- The plan someone learns on: their own Skillfirms plan, or the one their Talfirms plan includes.
create or replace function public._skillfirms_plan(p_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  with m as (
    select plan from public.skillfirms_memberships
    where user_id = p_user_id and status = 'active' and (active_until is null or active_until > now())
  ), t as (select public._effective_profile_plan(p_user_id) p)
  select case
    when exists (select 1 from m where plan = 'mastery') or (select p from t) = 'ultra' then 'mastery'
    when exists (select 1 from m where plan = 'scholar') or (select p from t) in ('pro', 'founding') then 'scholar'
    else 'free' end;
$$;
revoke all on function public._skillfirms_plan(uuid) from public, anon, authenticated;

create or replace function public.my_skillfirms_plan()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_plan text;
  v_p public.skillfirms_plans;
  v_m public.skillfirms_memberships;
  v_talfirms text;
begin
  if v_uid is null then return null; end if;
  v_plan := public._skillfirms_plan(v_uid);
  select * into v_p from public.skillfirms_plans where plan = v_plan;
  select * into v_m from public.skillfirms_memberships where user_id = v_uid;
  v_talfirms := public._effective_profile_plan(v_uid);
  return jsonb_build_object(
    'plan', v_plan, 'name', v_p.name,
    'via_talfirms', v_plan <> 'free' and not exists (select 1 from public.skillfirms_memberships where user_id = v_uid and status = 'active'
                      and plan = v_plan and (active_until is null or active_until > now())),
    'talfirms_plan', v_talfirms,
    'tutor_per_day', v_p.tutor_per_day,
    'tutor_today', (select count(*) from public.ai_usage_log where user_id = v_uid and feature = 'skillfirms_tutor'
                      and status = 'success' and created_at >= date_trunc('day', now())),
    'check_tries_per_day', v_p.check_tries_per_day,
    'expert_discount_pct', v_p.expert_discount_pct,
    'priority_review', v_p.priority_review,
    'membership', case when v_m.user_id is null then null else jsonb_build_object(
      'plan', v_m.plan, 'billing', v_m.billing, 'status', v_m.status, 'active_until', v_m.active_until) end);
end;
$$;
revoke all on function public.my_skillfirms_plan() from public, anon;
grant execute on function public.my_skillfirms_plan() to authenticated;

create or replace function public.skillfirms_join_plan(p_plan text, p_billing text default 'monthly')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_open boolean := coalesce((select enabled from public.app_flags where key = 'skillfirms_plan_sales'), false);
  v_m public.skillfirms_memberships;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if p_plan not in ('scholar', 'mastery') or p_billing not in ('monthly', 'yearly') then raise exception 'bad_plan'; end if;
  insert into public.skillfirms_memberships (user_id, plan, billing, status)
  values (auth.uid(), p_plan, p_billing, case when v_open then 'awaiting_payment' else 'waitlist' end)
  on conflict (user_id) do update set
    plan = case when public.skillfirms_memberships.status = 'active' and public.skillfirms_memberships.active_until > now()
                then public.skillfirms_memberships.plan else excluded.plan end,
    billing = excluded.billing,
    status = case when public.skillfirms_memberships.status = 'active' and public.skillfirms_memberships.active_until > now()
                  then 'active' else excluded.status end,
    updated_at = now()
  returning * into v_m;
  return to_jsonb(v_m);
end;
$$;
revoke all on function public.skillfirms_join_plan(text, text) from public, anon;
grant execute on function public.skillfirms_join_plan(text, text) to authenticated;

create or replace function public.skillfirms_admin_memberships()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.skillfirms_is_admin() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', coalesce(p.display_name, p.username), 'username', p.username,
      'plan', m.plan, 'billing', m.billing, 'status', m.status, 'active_until', m.active_until, 'created_at', m.created_at)
      order by (m.status in ('waitlist', 'awaiting_payment')) desc, m.created_at desc)
    from public.skillfirms_memberships m left join public.profiles p on p.id = m.user_id), '[]'::jsonb) end;
$$;
revoke all on function public.skillfirms_admin_memberships() from public, anon;
grant execute on function public.skillfirms_admin_memberships() to authenticated;

-- Switch a plan on (e.g. paid by invoice) for N months, or off with 0.
create or replace function public.skillfirms_admin_set_membership(p_user_id uuid, p_months integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  if p_months is null or p_months < 0 or p_months > 36 then raise exception 'bad_months'; end if;
  update public.skillfirms_memberships set
    status = case when p_months = 0 then 'ended' else 'active' end,
    active_until = case when p_months = 0 then now() else greatest(coalesce(active_until, now()), now()) + make_interval(months => p_months) end,
    updated_at = now()
  where user_id = p_user_id;
  if not found then raise exception 'no_membership'; end if;
end;
$$;
revoke all on function public.skillfirms_admin_set_membership(uuid, integer) from public, anon;
grant execute on function public.skillfirms_admin_set_membership(uuid, integer) to authenticated;

-- 2. Plan discount on expert courses (the expert still earns 50% of the full price) ------------------
alter table public.skillfirms_course_purchases add column if not exists list_price_cents integer;

create or replace function public.skillfirms_buy_course(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c public.skillfirms_courses;
  v_open boolean := coalesce((select enabled from public.app_flags where key = 'skillfirms_course_sales'), false);
  v_pct integer;
  v_pay integer;
  v_p public.skillfirms_course_purchases;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select * into v_c from public.skillfirms_courses where id = p_course_id and status = 'published';
  if v_c.id is null then raise exception 'not_found'; end if;
  if v_c.price_cents = 0 then raise exception 'free_course'; end if;
  select expert_discount_pct into v_pct from public.skillfirms_plans where plan = public._skillfirms_plan(auth.uid());
  v_pay := v_c.price_cents - round(v_c.price_cents * coalesce(v_pct, 0) / 100.0)::int;
  insert into public.skillfirms_course_purchases (user_id, course_id, price_cents, list_price_cents, status)
  values (auth.uid(), v_c.id, v_pay, v_c.price_cents, case when v_open then 'awaiting_payment' else 'waitlist' end)
  on conflict (user_id, course_id) do update set
    status = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit')
      then public.skillfirms_course_purchases.status else excluded.status end,
    price_cents = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit')
      then public.skillfirms_course_purchases.price_cents else excluded.price_cents end,
    list_price_cents = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit')
      then public.skillfirms_course_purchases.list_price_cents else excluded.list_price_cents end
  returning * into v_p;
  return to_jsonb(v_p);
end;
$$;
revoke all on function public.skillfirms_buy_course(uuid) from public, anon;
grant execute on function public.skillfirms_buy_course(uuid) to authenticated;

create or replace function public.skillfirms_admin_grant_course(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  update public.skillfirms_course_purchases set status = 'paid', payment_status = 'credit', paid_at = now(),
    instructor_share_cents = round(coalesce(list_price_cents, price_cents) * 0.5)
  where id = p_purchase_id and payment_status = 'unpaid';
end;
$$;
revoke all on function public.skillfirms_admin_grant_course(uuid) from public, anon;
grant execute on function public.skillfirms_admin_grant_course(uuid) to authenticated;

-- 3. Mastery members' work is reviewed first ---------------------------------------------------------
create or replace function public.skillfirms_expert_queue()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_e public.skillfirms_experts := public._skillfirms_my_expert();
begin
  if v_e.id is null then raise exception 'experts_only'; end if;
  return jsonb_build_object(
    'available', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'mission', m.title, 'difficulty', m.difficulty, 'paid_at', o.paid_at,
        'earn_cents', round(o.price_cents * v_e.payout_share),
        'priority', public._skillfirms_plan(o.user_id) = 'mastery',
        'skills', (select jsonb_agg(sk.name) from public.skillfirms_mission_skills ms join public.skillfirms_skills sk on sk.id = ms.skill_id where ms.mission_id = m.id)
      ) order by (public._skillfirms_plan(o.user_id) = 'mastery') desc, o.paid_at)
      from public.skillfirms_review_orders o join public.skillfirms_missions m on m.id = o.mission_id
      where o.user_id <> v_e.profile_id
        and (o.status = 'paid' or (o.status = 'claimed' and o.due_at < now() and o.expert_id <> v_e.id))
        and exists (select 1 from public.skillfirms_mission_skills ms join public.skillfirms_expert_skills es on es.skill_id = ms.skill_id
                    where ms.mission_id = o.mission_id and es.expert_id = v_e.id)), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'status', o.status, 'due_at', o.due_at, 'mission', m.title, 'brief', m.brief, 'instructions', m.deliverable_instructions,
        'submission', s.submission_text, 'submitted_at', s.submitted_at, 'earn_cents', round(o.price_cents * v_e.payout_share),
        'skills', (select jsonb_agg(jsonb_build_object('id', sk.id, 'name', sk.name)) from public.skillfirms_mission_skills ms join public.skillfirms_skills sk on sk.id = ms.skill_id where ms.mission_id = m.id)
      ) order by o.due_at)
      from public.skillfirms_review_orders o join public.skillfirms_missions m on m.id = o.mission_id join public.skillfirms_mission_submissions s on s.id = o.submission_id
      where o.expert_id = v_e.id and o.status = 'claimed' and o.due_at >= now()), '[]'::jsonb),
    'earnings', jsonb_build_object(
      'reviews', (select count(*) from public.skillfirms_review_orders where expert_id = v_e.id and status = 'reviewed'),
      'earned_cents', (select coalesce(sum(expert_payout_cents), 0) from public.skillfirms_review_orders where expert_id = v_e.id and status = 'reviewed'),
      'share', v_e.payout_share)
  );
end;
$$;
revoke all on function public.skillfirms_expert_queue() from public, anon;
grant execute on function public.skillfirms_expert_queue() to authenticated;

-- 4. Timed checks -------------------------------------------------------------------------------------
alter table public.skillfirms_courses add column if not exists check_minutes integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'skillfirms_courses_check_minutes_range') then
    alter table public.skillfirms_courses add constraint skillfirms_courses_check_minutes_range check (check_minutes is null or check_minutes between 1 and 120);
  end if;
end $$;

create table if not exists public.skillfirms_check_starts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id uuid not null references public.skillfirms_course_modules (id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  submitted_at timestamptz
);
create index if not exists skillfirms_check_starts_user_module on public.skillfirms_check_starts (user_id, module_id, started_at desc);
alter table public.skillfirms_check_starts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_check_starts' and policyname = 'see my check starts') then
    create policy "see my check starts" on public.skillfirms_check_starts for select using (user_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.skillfirms_check_starts from anon;
revoke insert, update, delete on public.skillfirms_check_starts from authenticated;
grant select on public.skillfirms_check_starts to authenticated;

-- Experts set (or clear, with null) the time limit on their own course's checks.
create or replace function public.skillfirms_studio_set_check_minutes(p_course_id uuid, p_minutes integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.skillfirms_courses := public._skillfirms_my_course(p_course_id);
begin
  if v_c.id is null then raise exception 'not_yours'; end if;
  if p_minutes is not null and (p_minutes < 1 or p_minutes > 120) then raise exception 'bad_minutes: 1 to 120 minutes'; end if;
  update public.skillfirms_courses set check_minutes = p_minutes where id = v_c.id;
end;
$$;
revoke all on function public.skillfirms_studio_set_check_minutes(uuid, integer) from public, anon;
grant execute on function public.skillfirms_studio_set_check_minutes(uuid, integer) to authenticated;

-- Can this visitor see a lesson's check questions? Untimed: yes. Timed: only
-- while their own clock is running (and the course's expert or an admin).
create or replace function public.skillfirms_can_see_questions(p_module_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.check_minutes is null
      or public.skillfirms_is_admin()
      or c.expert_id in (select id from public.skillfirms_experts where profile_id = auth.uid())
      or exists (select 1 from public.skillfirms_check_starts s where s.module_id = p_module_id and s.user_id = auth.uid()
                 and s.submitted_at is null and s.ends_at > now() - interval '1 minute')
    from public.skillfirms_course_modules m join public.skillfirms_courses c on c.id = m.course_id where m.id = p_module_id), false);
$$;
revoke all on function public.skillfirms_can_see_questions(uuid) from public;
grant execute on function public.skillfirms_can_see_questions(uuid) to anon, authenticated;

drop policy if exists "quiz questions are publicly readable" on public.skillfirms_module_quiz_questions;
create policy "quiz questions are publicly readable" on public.skillfirms_module_quiz_questions for select
  using (public.skillfirms_can_see_questions(module_id));

create or replace function public.skillfirms_start_check(p_module_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_course public.skillfirms_courses;
  v_s public.skillfirms_check_starts;
  v_tries integer;
  v_used integer;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select c.* into v_course from public.skillfirms_course_modules m join public.skillfirms_courses c on c.id = m.course_id where m.id = p_module_id;
  if v_course.id is null then raise exception 'not_found'; end if;
  if v_course.check_minutes is null then return jsonb_build_object('timed', false); end if;
  if not exists (select 1 from public.skillfirms_enrollments where user_id = auth.uid() and course_id = v_course.id) then
    raise exception 'enroll_first';
  end if;
  select * into v_s from public.skillfirms_check_starts
    where user_id = auth.uid() and module_id = p_module_id and submitted_at is null and ends_at > now()
    order by ends_at desc limit 1;
  if v_s.id is null then
    select check_tries_per_day into v_tries from public.skillfirms_plans where plan = public._skillfirms_plan(auth.uid());
    select count(*) into v_used from public.skillfirms_check_starts
      where user_id = auth.uid() and module_id = p_module_id and started_at > now() - interval '24 hours';
    if v_used >= coalesce(v_tries, 5) then raise exception 'too_many_tries: you''ve used today''s % tries for this check', coalesce(v_tries, 5); end if;
    insert into public.skillfirms_check_starts (user_id, module_id, ends_at)
    values (auth.uid(), p_module_id, now() + make_interval(mins => v_course.check_minutes))
    returning * into v_s;
  end if;
  return jsonb_build_object('timed', true, 'minutes', v_course.check_minutes, 'started_at', v_s.started_at, 'ends_at', v_s.ends_at,
    'seconds_left', greatest(0, floor(extract(epoch from (v_s.ends_at - now()))))::int);
end;
$$;
revoke all on function public.skillfirms_start_check(uuid) from public, anon;
grant execute on function public.skillfirms_start_check(uuid) to authenticated;

-- Grading: same as before, plus the plan's daily tries and, on timed
-- courses, a running clock (30 seconds' grace for slow connections).
create or replace function public.skillfirms_submit_quiz(p_module_id uuid, p_answers jsonb)
returns numeric language plpgsql security definer set search_path = public as $$
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
  v_minutes integer;
  v_start public.skillfirms_check_starts;
  v_tries integer;
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

  select check_minutes into v_minutes from public.skillfirms_courses where id = v_course_id;
  if v_minutes is not null then
    select * into v_start from public.skillfirms_check_starts
      where user_id = (select auth.uid()) and module_id = p_module_id and submitted_at is null
      order by ends_at desc limit 1;
    if v_start.id is null then raise exception 'start_first: start the timed check first'; end if;
    if now() > v_start.ends_at + interval '30 seconds' then raise exception 'time_up: the time for this check ran out. Start it again to retry.'; end if;
  end if;

  select check_tries_per_day into v_tries from public.skillfirms_plans where plan = public._skillfirms_plan((select auth.uid()));
  v_tries := coalesce(v_tries, 5);
  select mp.attempt_count, mp.last_attempt_at into v_prior_attempts, v_prior_last_attempt
    from public.skillfirms_module_progress mp where mp.enrollment_id = v_enrollment_id and mp.module_id = p_module_id;
  if v_prior_attempts is not null and v_prior_attempts >= v_tries
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

  if v_start.id is not null then
    update public.skillfirms_check_starts set submitted_at = now() where id = v_start.id;
  end if;

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
    select count(*) into v_course_modules from public.skillfirms_course_modules where course_id = v_course_id;
    select count(*) into v_course_done from public.skillfirms_module_progress p
      join public.skillfirms_course_modules m on m.id = p.module_id and m.course_id = v_course_id
      where p.enrollment_id = v_enrollment_id and p.completed_at is not null;
    for v_cs in select skill_id, coverage from public.skillfirms_course_skills where course_id = v_course_id loop
      perform public.skillfirms_apply_skill_estimate((select auth.uid()), v_cs.skill_id,
        v_cs.coverage * v_score * v_course_done / greatest(v_course_modules, 1), 'assessment_based');
    end loop;

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
$$;

select true as ok;
