-- 0032: No learner plans. Learning stays free; the AI tutor runs on a free
-- daily allowance (your Talfirms plan's quick AI helps) plus question packs
-- you buy once and keep. Experts set their own prices and earn more than on
-- Udemy: 70% when Skillfirms finds the student, 97% through their own link,
-- and 50% of company team-training money, shared by learning minutes.
-- Safe to run more than once. Replaces the plan rules from 0031.

-- 1. Retire the 0031 learner plans (kept for history, no longer used) ---------------------------------
revoke select on public.skillfirms_plans from anon, authenticated;
revoke execute on function public.my_skillfirms_plan() from authenticated;
revoke execute on function public.skillfirms_join_plan(text, text) from authenticated;

-- 2. Tutor question packs ------------------------------------------------------------------------------
create table if not exists public.skillfirms_credit_packs (
  pack text primary key,
  questions integer not null check (questions > 0),
  price_cents integer not null check (price_cents > 0),
  sort integer not null default 0
);
alter table public.skillfirms_credit_packs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_credit_packs' and policyname = 'packs are public') then
    create policy "packs are public" on public.skillfirms_credit_packs for select using (true);
  end if;
end $$;
revoke insert, update, delete on public.skillfirms_credit_packs from anon, authenticated;
grant select on public.skillfirms_credit_packs to anon, authenticated;
insert into public.skillfirms_credit_packs (pack, questions, price_cents, sort) values
  ('q20', 20, 199, 1), ('q50', 50, 399, 2), ('q100', 100, 699, 3)
on conflict (pack) do update set questions = excluded.questions, price_cents = excluded.price_cents, sort = excluded.sort;

create table if not exists public.skillfirms_tutor_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.skillfirms_tutor_wallets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_tutor_wallets' and policyname = 'see my wallet') then
    create policy "see my wallet" on public.skillfirms_tutor_wallets for select using (user_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.skillfirms_tutor_wallets from anon;
revoke insert, update, delete on public.skillfirms_tutor_wallets from authenticated;
grant select on public.skillfirms_tutor_wallets to authenticated;

create table if not exists public.skillfirms_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pack text not null references public.skillfirms_credit_packs (pack),
  questions integer not null,
  price_cents integer not null,
  status text not null default 'waitlist' check (status in ('waitlist', 'awaiting_payment', 'paid', 'credit')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists skillfirms_credit_purchases_user on public.skillfirms_credit_purchases (user_id, created_at desc);
alter table public.skillfirms_credit_purchases enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_credit_purchases' and policyname = 'see my credit purchases') then
    create policy "see my credit purchases" on public.skillfirms_credit_purchases for select using (user_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.skillfirms_credit_purchases from anon;
revoke insert, update, delete on public.skillfirms_credit_purchases from authenticated;
grant select on public.skillfirms_credit_purchases to authenticated;

insert into public.app_flags (key, enabled) values ('skillfirms_credit_sales', false) on conflict (key) do nothing;

create or replace function public.skillfirms_buy_credits(p_pack text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pack public.skillfirms_credit_packs;
  v_open boolean := coalesce((select enabled from public.app_flags where key = 'skillfirms_credit_sales'), false);
  v_p public.skillfirms_credit_purchases;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select * into v_pack from public.skillfirms_credit_packs where pack = p_pack;
  if v_pack.pack is null then raise exception 'bad_pack'; end if;
  -- One open request per person: a new pick replaces the one still waiting.
  update public.skillfirms_credit_purchases set pack = v_pack.pack, questions = v_pack.questions, price_cents = v_pack.price_cents,
    status = case when v_open then 'awaiting_payment' else 'waitlist' end, created_at = now()
  where user_id = auth.uid() and status in ('waitlist', 'awaiting_payment')
  returning * into v_p;
  if v_p.id is null then
    insert into public.skillfirms_credit_purchases (user_id, pack, questions, price_cents, status)
    values (auth.uid(), v_pack.pack, v_pack.questions, v_pack.price_cents, case when v_open then 'awaiting_payment' else 'waitlist' end)
    returning * into v_p;
  end if;
  return to_jsonb(v_p);
end;
$$;
revoke all on function public.skillfirms_buy_credits(text) from public, anon;
grant execute on function public.skillfirms_buy_credits(text) to authenticated;

create or replace function public.skillfirms_admin_credit_purchases()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.skillfirms_is_admin() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'name', coalesce(p.display_name, p.username), 'pack', c.pack, 'questions', c.questions,
      'price_cents', c.price_cents, 'status', c.status, 'created_at', c.created_at, 'paid_at', c.paid_at)
      order by (c.status in ('waitlist', 'awaiting_payment')) desc, c.created_at desc)
    from (select * from public.skillfirms_credit_purchases order by created_at desc limit 200) c
    left join public.profiles p on p.id = c.user_id), '[]'::jsonb) end;
$$;
revoke all on function public.skillfirms_admin_credit_purchases() from public, anon;
grant execute on function public.skillfirms_admin_credit_purchases() to authenticated;

-- Paid outside the site (e.g. by invoice): add the questions to their balance, once.
create or replace function public.skillfirms_admin_grant_credits(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_p public.skillfirms_credit_purchases;
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  update public.skillfirms_credit_purchases set status = 'credit', paid_at = now()
  where id = p_purchase_id and status in ('waitlist', 'awaiting_payment')
  returning * into v_p;
  if v_p.id is null then raise exception 'already_done'; end if;
  insert into public.skillfirms_tutor_wallets (user_id, balance) values (v_p.user_id, v_p.questions)
  on conflict (user_id) do update set balance = public.skillfirms_tutor_wallets.balance + excluded.balance, updated_at = now();
end;
$$;
revoke all on function public.skillfirms_admin_grant_credits(uuid) from public, anon;
grant execute on function public.skillfirms_admin_grant_credits(uuid) to authenticated;

-- Used by the tutor (service role only): take one saved question, if there is one.
create or replace function public._skillfirms_take_credit(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.skillfirms_tutor_wallets set balance = balance - 1, updated_at = now() where user_id = p_user and balance > 0;
  return found;
end;
$$;
revoke all on function public._skillfirms_take_credit(uuid) from public, anon, authenticated;

create or replace function public.my_tutor_wallet()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'balance', coalesce((select balance from public.skillfirms_tutor_wallets where user_id = auth.uid()), 0),
    'waiting', (select jsonb_build_object('pack', pack, 'questions', questions, 'status', status)
                from public.skillfirms_credit_purchases where user_id = auth.uid() and status in ('waitlist', 'awaiting_payment')
                order by created_at desc limit 1)) end;
$$;
revoke all on function public.my_tutor_wallet() from public, anon;
grant execute on function public.my_tutor_wallet() to authenticated;

-- Paid tutor questions never use up the free monthly AI allowance.
create or replace function public.my_ai_allowance()
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  with mine as (
    select
      count(*) filter (where status = 'success' and tier = 'simple' and created_at >= date_trunc('day', now())) q,
      count(*) filter (where status = 'success' and tier = 'standard' and created_at >= date_trunc('day', now())) d,
      count(*) filter (where status = 'success' and tier = 'simple') qm,
      count(*) filter (where status = 'success' and tier = 'standard') dm,
      count(*) filter (where status = 'success' and tier = 'deep') a,
      coalesce(sum(estimated_cost_usd), 0) cost
    from public.ai_usage_log
    where user_id = auth.uid() and created_at >= date_trunc('month', now()) and feature is distinct from 'skillfirms_tutor_credit'
  ),
  team as (
    select c.id, c.name, c.plan,
      count(u.*) filter (where u.tier = 'simple' and u.created_at >= date_trunc('day', now())) q,
      count(u.*) filter (where u.tier = 'standard' and u.created_at >= date_trunc('day', now())) d,
      count(u.*) filter (where u.tier = 'simple') qm,
      count(u.*) filter (where u.tier = 'standard') dm,
      count(u.*) filter (where u.tier = 'deep') a
    from public.company_members m
    join public.companies c on c.id = m.company_id and c.plan <> 'free'
    left join public.company_members tm on tm.company_id = c.id
    left join public.ai_usage_log u on u.user_id = tm.user_id and u.status = 'success' and u.created_at >= date_trunc('month', now())
      and u.feature is distinct from 'skillfirms_tutor_credit'
    where m.user_id = auth.uid()
    group by c.id, c.name, c.plan
  ),
  raw as (
    select l.plan, false as shared, null::text as company_name,
      l.quick_per_day, l.quick_per_month, l.drafts_per_day, l.drafts_per_month, l.advanced_per_month, l.max_output_tokens,
      l.monthly_cost_cap_usd, l.light_models,
      mine.q uq, mine.d ud, mine.qm uqm, mine.dm udm, mine.a ua
    from public.ai_plan_limits l, mine
    where l.plan = public._effective_profile_plan(auth.uid())
    union all
    select l.plan, true, team.name,
      l.quick_per_day, l.quick_per_month, l.drafts_per_day, l.drafts_per_month, l.advanced_per_month, l.max_output_tokens,
      l.monthly_cost_cap_usd, l.light_models,
      team.q, team.d, team.qm, team.dm, team.a
    from team join public.ai_plan_limits l on l.plan = team.plan
  ),
  options as (
    select plan, shared, company_name, max_output_tokens t, monthly_cost_cap_usd, light_models,
      case when quick_per_month is null then quick_per_day else least(quick_per_day, uq + greatest(quick_per_month - uqm, 0)) end lq,
      case when drafts_per_month is null then drafts_per_day else least(drafts_per_day, ud + greatest(drafts_per_month - udm, 0)) end ld,
      advanced_per_month la, uq, ud, ua, quick_per_month, drafts_per_month, uqm, udm
    from raw
  ),
  q as (select * from options order by (lq - uq) desc, la desc limit 1),
  d as (select * from options order by (ld - ud) desc, la desc limit 1),
  a as (select * from options order by (la - ua) desc, la desc limit 1),
  freeonly as (select not exists (select 1 from options where monthly_cost_cap_usd is null) f)
  select case when auth.uid() is null then null else jsonb_build_object(
    'plan', coalesce((select plan from a), 'free'),
    'shared', coalesce((select shared from a), false),
    'company_name', (select company_name from a),
    'quick_per_day', coalesce((select lq from q), 5), 'quick_today', coalesce((select uq from q), 0),
    'quick_per_month', (select quick_per_month from q), 'quick_this_month', (select uqm from q),
    'drafts_per_day', coalesce((select ld from d), 1), 'drafts_today', coalesce((select ud from d), 0),
    'drafts_per_month', (select drafts_per_month from d), 'drafts_this_month', (select udm from d),
    'advanced_per_month', coalesce((select la from a), 3), 'advanced_this_month', coalesce((select ua from a), 0),
    'max_output_tokens', case when (select f from freeonly) then coalesce((select min(t) from options), 1500) else coalesce((select max(t) from options), 2500) end,
    'light_models', coalesce((select f from freeonly), true),
    'cost_cap_usd', case when (select f from freeonly) then coalesce((select min(monthly_cost_cap_usd) from options), 0.10) end,
    'cost_this_month_usd', (select cost from mine)
  ) end;
$function$;

-- 3. Expert sales: own link (97%) or Skillfirms marketplace (70%) ---------------------------------------
alter table public.skillfirms_experts add column if not exists ref_code text;
update public.skillfirms_experts set ref_code = substr(md5(id::text || clock_timestamp()::text), 1, 8) where ref_code is null;
alter table public.skillfirms_experts alter column ref_code set default substr(md5(gen_random_uuid()::text), 1, 8);
create unique index if not exists skillfirms_experts_ref_code on public.skillfirms_experts (ref_code);

alter table public.skillfirms_course_purchases add column if not exists channel text not null default 'marketplace';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'skillfirms_course_purchases_channel_check') then
    alter table public.skillfirms_course_purchases add constraint skillfirms_course_purchases_channel_check check (channel in ('marketplace', 'expert_link'));
  end if;
end $$;

-- What the expert keeps, by how the student came.
create or replace function public.skillfirms_expert_share(p_channel text)
returns numeric language sql immutable as $$
  select case when p_channel = 'expert_link' then 0.97 else 0.70 end;
$$;
grant execute on function public.skillfirms_expert_share(text) to anon, authenticated;

create or replace function public.skillfirms_buy_course_v2(p_course_id uuid, p_ref text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c public.skillfirms_courses;
  v_open boolean := coalesce((select enabled from public.app_flags where key = 'skillfirms_course_sales'), false);
  v_channel text := 'marketplace';
  v_p public.skillfirms_course_purchases;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select * into v_c from public.skillfirms_courses where id = p_course_id and status = 'published';
  if v_c.id is null then raise exception 'not_found'; end if;
  if v_c.price_cents = 0 then raise exception 'free_course'; end if;
  -- Their own link counts only for their own course.
  if p_ref is not null and exists (select 1 from public.skillfirms_experts e where e.id = v_c.expert_id and e.ref_code = p_ref) then
    v_channel := 'expert_link';
  end if;
  insert into public.skillfirms_course_purchases (user_id, course_id, price_cents, list_price_cents, status, channel)
  values (auth.uid(), v_c.id, v_c.price_cents, v_c.price_cents, case when v_open then 'awaiting_payment' else 'waitlist' end, v_channel)
  on conflict (user_id, course_id) do update set
    status = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit') then public.skillfirms_course_purchases.status else excluded.status end,
    price_cents = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit') then public.skillfirms_course_purchases.price_cents else excluded.price_cents end,
    list_price_cents = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit') then public.skillfirms_course_purchases.list_price_cents else excluded.list_price_cents end,
    channel = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit') then public.skillfirms_course_purchases.channel
                   when excluded.channel = 'expert_link' then 'expert_link' else public.skillfirms_course_purchases.channel end
  returning * into v_p;
  return to_jsonb(v_p);
end;
$$;
revoke all on function public.skillfirms_buy_course_v2(uuid, text) from public, anon;
grant execute on function public.skillfirms_buy_course_v2(uuid, text) to authenticated;
-- The old buy (no link, no channel) goes quiet; everything uses v2.
revoke execute on function public.skillfirms_buy_course(uuid) from authenticated;

create or replace function public.skillfirms_admin_grant_course(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  update public.skillfirms_course_purchases set status = 'paid', payment_status = 'credit', paid_at = now(),
    instructor_share_cents = round(price_cents * public.skillfirms_expert_share(channel))
  where id = p_purchase_id and payment_status = 'unpaid';
end;
$$;
revoke all on function public.skillfirms_admin_grant_course(uuid) from public, anon;
grant execute on function public.skillfirms_admin_grant_course(uuid) to authenticated;

-- Experts change their price whenever they like (new buyers pay the new price).
create or replace function public.skillfirms_studio_set_price(p_course_id uuid, p_price_cents integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.skillfirms_courses := public._skillfirms_my_course(p_course_id);
begin
  if v_c.id is null then raise exception 'not_yours'; end if;
  if p_price_cents is null or not (p_price_cents = 0 or p_price_cents between 900 and 19900) then
    raise exception 'bad_price: free, or $9 to $199';
  end if;
  update public.skillfirms_courses set price_cents = p_price_cents where id = v_c.id;
end;
$$;
revoke all on function public.skillfirms_studio_set_price(uuid, integer) from public, anon;
grant execute on function public.skillfirms_studio_set_price(uuid, integer) to authenticated;

-- The expert's own link code (for the studio).
create or replace function public.skillfirms_my_ref_code()
returns text language sql stable security definer set search_path = public as $$
  select ref_code from public.skillfirms_experts where profile_id = auth.uid() and active;
$$;
revoke all on function public.skillfirms_my_ref_code() from public, anon;
grant execute on function public.skillfirms_my_ref_code() to authenticated;

-- 4. Company team training: 50% to experts, by learning minutes -----------------------------------------
-- Minutes = the length of each expert-course lesson a company's team member passed
-- (on a course their company assigned). Used for the monthly payout split.
create or replace function public._skillfirms_team_minutes(p_from timestamptz, p_to timestamptz)
returns table (expert_id uuid, course_id uuid, minutes bigint) language sql stable security definer set search_path = public as $$
  select c.expert_id, c.id, sum(coalesce(m.duration_minutes, 0))::bigint
  from public.skillfirms_module_progress p
  join public.skillfirms_enrollments e on e.id = p.enrollment_id
  join public.skillfirms_course_modules m on m.id = p.module_id
  join public.skillfirms_courses c on c.id = m.course_id and c.taught_by = 'expert' and c.expert_id is not null
  where p.completed_at >= p_from and p.completed_at < p_to
    and exists (select 1 from public.skillfirms_team_members tm join public.skillfirms_team_assignments a on a.company_id = tm.company_id
                and (a.profile_id is null or a.profile_id = tm.profile_id)
                where tm.profile_id = e.user_id and a.course_id = c.id)
  group by c.expert_id, c.id;
$$;
revoke all on function public._skillfirms_team_minutes(timestamptz, timestamptz) from public, anon, authenticated;

-- Admin: given the month and what companies paid for team training, each expert's share.
create or replace function public.skillfirms_admin_team_pool(p_month date, p_revenue_cents integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_from timestamptz := date_trunc('month', p_month::timestamptz);
  v_to timestamptz := date_trunc('month', p_month::timestamptz) + interval '1 month';
  v_total bigint;
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  if p_revenue_cents is null or p_revenue_cents < 0 then raise exception 'bad_revenue'; end if;
  select coalesce(sum(minutes), 0) into v_total from public._skillfirms_team_minutes(v_from, v_to);
  return jsonb_build_object('pool_cents', round(p_revenue_cents * 0.5), 'total_minutes', v_total,
    'experts', coalesce((select jsonb_agg(jsonb_build_object('expert', x.display_name, 'minutes', x.minutes,
        'share_cents', case when v_total = 0 then 0 else round(p_revenue_cents * 0.5 * x.minutes / v_total) end) order by x.minutes desc)
      from (select e.display_name, sum(t.minutes) minutes from public._skillfirms_team_minutes(v_from, v_to) t
            join public.skillfirms_experts e on e.id = t.expert_id group by e.display_name) x), '[]'::jsonb));
end;
$$;
revoke all on function public.skillfirms_admin_team_pool(date, integer) from public, anon;
grant execute on function public.skillfirms_admin_team_pool(date, integer) to authenticated;

-- Experts: their own team-training minutes this month, per course.
create or replace function public.skillfirms_studio_team_minutes()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(t.course_id, t.minutes), '{}'::jsonb)
  from public._skillfirms_team_minutes(date_trunc('month', now()), date_trunc('month', now()) + interval '1 month') t
  where t.expert_id = (select id from public.skillfirms_experts where profile_id = auth.uid() and active);
$$;
revoke all on function public.skillfirms_studio_team_minutes() from public, anon;
grant execute on function public.skillfirms_studio_team_minutes() to authenticated;

-- 5. Checks: 5 tries a day for everyone again (no plans); timed checks unchanged -----------------------
create or replace function public.skillfirms_start_check(p_module_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_course public.skillfirms_courses;
  v_s public.skillfirms_check_starts;
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
    select count(*) into v_used from public.skillfirms_check_starts
      where user_id = auth.uid() and module_id = p_module_id and started_at > now() - interval '24 hours';
    if v_used >= 5 then raise exception 'too_many_tries: you''ve used today''s 5 tries for this check'; end if;
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

-- Expert review queue: back to first paid, first reviewed (no plan priority).
create or replace function public.skillfirms_expert_queue()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_e public.skillfirms_experts := public._skillfirms_my_expert();
begin
  if v_e.id is null then raise exception 'experts_only'; end if;
  return jsonb_build_object(
    'available', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'mission', m.title, 'difficulty', m.difficulty, 'paid_at', o.paid_at,
        'earn_cents', round(o.price_cents * v_e.payout_share),
        'skills', (select jsonb_agg(sk.name) from public.skillfirms_mission_skills ms join public.skillfirms_skills sk on sk.id = ms.skill_id where ms.mission_id = m.id)
      ) order by o.paid_at)
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

select true as ok;
