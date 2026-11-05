-- Real experts and paid expert-reviewed Missions.
--
-- 0. Security fixes:
--    * anyone could add themselves to skillfirms_experts and then review any
--      submission (even their own) and issue themselves an "expert verified"
--      credential. Now only an admin makes someone an expert (by approving
--      an application), and an expert can review only a submission they
--      were assigned through a paid review order, never their own.
--    * every expert could read every learner's name and work. Now reviews
--      are blind: an expert sees only the work they claimed, without a name.
-- 1. Experts apply (headline, experience, the skills they can judge, links);
--    an admin approves or declines.
-- 2. A learner orders a review of a Mission submission (price by
--    difficulty: $29 / $39 / $49). Until paid reviews are switched on
--    (app_flags 'skillfirms_paid_reviews') and an expert covers the
--    mission's skills, the request joins a waiting list and nothing is
--    charged. An admin can mark an order paid (credit) until Stripe is on.
-- 3. An expert whose skills match claims a paid order (3 days to finish),
--    scores each skill, writes feedback and decides pass / not yet. A pass
--    (and overall score >= 60%) issues the "expert verified" credential,
--    which reaches Talfirms as verified proof. The expert earns 60%.
-- 4. Paid orders not reviewed within 7 days are marked refund_due.

-- 0. Security ------------------------------------------------------------------------------------
drop policy if exists "admins and self insert experts" on public.skillfirms_experts;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_experts' and policyname = 'admins insert experts') then
    create policy "admins insert experts" on public.skillfirms_experts for insert with check (public.skillfirms_is_admin());
  end if;
end $$;
alter table public.skillfirms_experts add column if not exists active boolean not null default true;
alter table public.skillfirms_experts add column if not exists payout_share numeric not null default 0.60 check (payout_share between 0 and 1);
alter table public.skillfirms_experts add column if not exists approved_at timestamptz;
revoke insert, update on public.skillfirms_experts from authenticated, anon;
grant update (headline, bio, credentials) on public.skillfirms_experts to authenticated;

drop policy if exists "mission submissions read access" on public.skillfirms_mission_submissions;
drop policy if exists "experts can see submissions pending review" on public.skillfirms_mission_submissions;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_mission_submissions' and policyname = 'learners read their own submissions') then
    create policy "learners read their own submissions" on public.skillfirms_mission_submissions for select using (user_id = (select auth.uid()));
  end if;
end $$;
-- Status changes go through functions; the text can't change once a review is ordered (trigger below).
revoke update on public.skillfirms_mission_submissions from authenticated;
grant update (status, submission_text) on public.skillfirms_mission_submissions to authenticated;

drop policy if exists "mission evaluations read access" on public.skillfirms_mission_evaluations;
drop policy if exists "experts see evaluations too" on public.skillfirms_mission_evaluations;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_mission_evaluations' and policyname = 'learners read evaluations of their work') then
    create policy "learners read evaluations of their work" on public.skillfirms_mission_evaluations for select
      using (submission_id in (select id from public.skillfirms_mission_submissions where user_id = (select auth.uid())));
  end if;
end $$;

-- The old "any expert reviews anything" function now refuses.
create or replace function public.skillfirms_expert_review_submission(p_submission_id uuid, p_overall_score numeric, p_feedback text, p_strengths jsonb, p_improvements jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  raise exception 'use_review_orders: expert reviews go through a claimed review order';
end;
$$;
revoke all on function public.skillfirms_expert_review_submission(uuid, numeric, text, jsonb, jsonb) from public, anon, authenticated;

-- 1. Expert applications --------------------------------------------------------------------------
create table if not exists public.skillfirms_expert_skills (
  expert_id uuid not null references public.skillfirms_experts(id) on delete cascade,
  skill_id uuid not null references public.skillfirms_skills(id) on delete cascade,
  primary key (expert_id, skill_id)
);
alter table public.skillfirms_expert_skills enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_expert_skills' and policyname = 'expert skills are public') then
    create policy "expert skills are public" on public.skillfirms_expert_skills for select using (true);
  end if;
end $$;
revoke insert, update, delete on public.skillfirms_expert_skills from anon, authenticated;
grant select on public.skillfirms_expert_skills to anon, authenticated;

create table if not exists public.skillfirms_expert_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  headline text not null check (char_length(btrim(headline)) between 3 and 120),
  experience text not null check (char_length(btrim(experience)) between 50 and 3000),
  years integer not null check (years between 0 and 60),
  skill_ids uuid[] not null check (cardinality(skill_ids) between 1 and 10),
  links text check (char_length(links) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  admin_note text check (char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index if not exists skillfirms_expert_applications_one_pending on public.skillfirms_expert_applications (profile_id) where status = 'pending';
alter table public.skillfirms_expert_applications enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_expert_applications' and policyname = 'applicants read their own') then
    create policy "applicants read their own" on public.skillfirms_expert_applications for select using (profile_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.skillfirms_expert_applications from anon;
revoke insert, update, delete on public.skillfirms_expert_applications from authenticated;
grant select on public.skillfirms_expert_applications to authenticated;

create or replace function public.skillfirms_apply_as_expert(p_headline text, p_experience text, p_years integer, p_skill_ids uuid[], p_links text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if exists (select 1 from public.skillfirms_experts where profile_id = auth.uid()) then raise exception 'already_an_expert'; end if;
  if exists (select 1 from public.skillfirms_expert_applications where profile_id = auth.uid() and status = 'pending') then raise exception 'already_applied'; end if;
  perform public.check_rate_limit('skillfirms_apply_as_expert', 3, 86400);
  insert into public.skillfirms_expert_applications (profile_id, headline, experience, years, skill_ids, links)
  values (auth.uid(), btrim(p_headline), btrim(p_experience), p_years,
          (select coalesce(array_agg(distinct s.id), '{}') from public.skillfirms_skills s where s.id = any(p_skill_ids)),
          nullif(btrim(coalesce(p_links, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.skillfirms_apply_as_expert(text, text, integer, uuid[], text) from public, anon;
grant execute on function public.skillfirms_apply_as_expert(text, text, integer, uuid[], text) to authenticated;

create or replace function public.skillfirms_admin_expert_applications()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.skillfirms_is_admin() then '[]'::jsonb else coalesce(jsonb_agg(x order by (x->>'status' = 'pending') desc, x->>'created_at' desc), '[]'::jsonb) end
  from (
    select jsonb_build_object(
      'id', a.id, 'status', a.status, 'headline', a.headline, 'experience', a.experience, 'years', a.years, 'links', a.links,
      'created_at', a.created_at, 'admin_note', a.admin_note,
      'name', p.display_name, 'username', p.username,
      'skills', (select coalesce(jsonb_agg(s.name order by s.name), '[]') from public.skillfirms_skills s where s.id = any(a.skill_ids))
    ) x
    from public.skillfirms_expert_applications a join public.profiles p on p.id = a.profile_id
    order by a.created_at desc limit 200
  ) t;
$$;
revoke all on function public.skillfirms_admin_expert_applications() from public, anon;
grant execute on function public.skillfirms_admin_expert_applications() to authenticated;

create or replace function public.skillfirms_review_expert_application(p_application_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a public.skillfirms_expert_applications;
  v_expert uuid;
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  select * into v_a from public.skillfirms_expert_applications where id = p_application_id and status = 'pending' for update;
  if v_a.id is null then raise exception 'not_pending'; end if;
  if p_decision = 'approve' then
    select id into v_expert from public.skillfirms_experts where profile_id = v_a.profile_id;
    if v_expert is null then
      insert into public.skillfirms_experts (profile_id, display_name, headline, bio, approved_at, active)
      select v_a.profile_id, coalesce(p.display_name, p.username, 'Skillfirms expert'), v_a.headline, v_a.experience, now(), true
      from public.profiles p where p.id = v_a.profile_id
      returning id into v_expert;
    else
      update public.skillfirms_experts set active = true, approved_at = coalesce(approved_at, now()), headline = v_a.headline where id = v_expert;
    end if;
    insert into public.skillfirms_expert_skills (expert_id, skill_id) select v_expert, unnest(v_a.skill_ids) on conflict do nothing;
    update public.skillfirms_expert_applications set status = 'approved', admin_note = p_note, reviewed_at = now() where id = v_a.id;
  elsif p_decision = 'decline' then
    update public.skillfirms_expert_applications set status = 'declined', admin_note = coalesce(p_note, 'Not this time'), reviewed_at = now() where id = v_a.id;
  else
    raise exception 'unknown decision';
  end if;
end;
$$;
revoke all on function public.skillfirms_review_expert_application(uuid, text, text) from public, anon;
grant execute on function public.skillfirms_review_expert_application(uuid, text, text) to authenticated;

-- 2. Review orders --------------------------------------------------------------------------------
alter table public.skillfirms_missions add column if not exists review_price_cents integer not null default 3900 check (review_price_cents between 500 and 50000);
update public.skillfirms_missions set review_price_cents = case difficulty when 'beginner' then 2900 when 'advanced' then 4900 else 3900 end;

insert into public.app_flags (key, enabled) values ('skillfirms_paid_reviews', false) on conflict (key) do nothing;

create table if not exists public.skillfirms_review_orders (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.skillfirms_mission_submissions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.skillfirms_missions(id) on delete cascade,
  price_cents integer not null,
  status text not null default 'waitlist' check (status in ('waitlist', 'awaiting_payment', 'paid', 'claimed', 'reviewed', 'cancelled', 'refund_due')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'credit', 'refunded')),
  expert_id uuid references public.skillfirms_experts(id) on delete set null,
  paid_at timestamptz,
  claimed_at timestamptz,
  due_at timestamptz,
  reviewed_at timestamptz,
  expert_payout_cents integer,
  created_at timestamptz not null default now()
);
create index if not exists skillfirms_review_orders_open_idx on public.skillfirms_review_orders (status, paid_at) where status in ('paid', 'claimed');
create index if not exists skillfirms_review_orders_expert_idx on public.skillfirms_review_orders (expert_id);
create index if not exists skillfirms_review_orders_user_idx on public.skillfirms_review_orders (user_id);
alter table public.skillfirms_review_orders enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_review_orders' and policyname = 'learners read their own orders') then
    create policy "learners read their own orders" on public.skillfirms_review_orders for select using (user_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.skillfirms_review_orders from anon;
revoke insert, update, delete on public.skillfirms_review_orders from authenticated;
grant select on public.skillfirms_review_orders to authenticated;

-- Once a review is ordered (and not just waiting), the work can't be edited.
create or replace function public.skillfirms_submission_lock()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.submission_text is distinct from old.submission_text and exists (
      select 1 from public.skillfirms_review_orders o where o.submission_id = old.id and o.status not in ('waitlist', 'cancelled')) then
      raise exception 'locked_for_review: this work is with a reviewer';
    end if;
    if new.status is distinct from old.status and new.status not in ('submitted', 'ai_evaluated') then
      raise exception 'status_via_orders';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists skillfirms_submission_lock on public.skillfirms_mission_submissions;
create trigger skillfirms_submission_lock before update on public.skillfirms_mission_submissions
  for each row execute function public.skillfirms_submission_lock();

create or replace function public._skillfirms_experts_for_mission(p_mission_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(distinct e.id)::int from public.skillfirms_experts e
  join public.skillfirms_expert_skills es on es.expert_id = e.id
  join public.skillfirms_mission_skills ms on ms.skill_id = es.skill_id and ms.mission_id = p_mission_id
  where e.active and e.profile_id is not null;
$$;
revoke all on function public._skillfirms_experts_for_mission(uuid) from public, anon, authenticated;

create or replace function public.skillfirms_reviews_open()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.app_flags where key = 'skillfirms_paid_reviews'), false);
$$;

-- What a learner sees on a mission: price, how many experts can review it,
-- whether paid reviews are open, and their own order.
create or replace function public.skillfirms_mission_review_offer(p_mission_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'price_cents', m.review_price_cents,
    'experts', public._skillfirms_experts_for_mission(m.id),
    'open', public.skillfirms_reviews_open() and public._skillfirms_experts_for_mission(m.id) > 0,
    'order', (select jsonb_build_object('id', o.id, 'status', o.status, 'payment_status', o.payment_status, 'due_at', o.due_at,
                                        'submission_id', o.submission_id, 'created_at', o.created_at)
              from public.skillfirms_review_orders o join public.skillfirms_mission_submissions s on s.id = o.submission_id
              where o.user_id = auth.uid() and o.mission_id = m.id order by o.created_at desc limit 1)
  ) from public.skillfirms_missions m where m.id = p_mission_id and m.status = 'published';
$$;
revoke all on function public.skillfirms_mission_review_offer(uuid) from public;
grant execute on function public.skillfirms_mission_review_offer(uuid) to anon, authenticated;

create or replace function public.skillfirms_request_expert_review(p_submission_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s public.skillfirms_mission_submissions;
  v_open boolean;
  v_order public.skillfirms_review_orders;
begin
  select * into v_s from public.skillfirms_mission_submissions where id = p_submission_id and user_id = auth.uid();
  if v_s.id is null then raise exception 'not_found'; end if;
  if char_length(btrim(coalesce(v_s.submission_text, ''))) < 200 then raise exception 'too_short: write at least 200 characters before asking an expert'; end if;
  select * into v_order from public.skillfirms_review_orders where submission_id = v_s.id;
  if v_order.id is not null and v_order.status not in ('waitlist', 'cancelled') then return to_jsonb(v_order); end if;
  v_open := public.skillfirms_reviews_open() and public._skillfirms_experts_for_mission(v_s.mission_id) > 0;
  insert into public.skillfirms_review_orders (submission_id, user_id, mission_id, price_cents, status)
  select v_s.id, v_s.user_id, v_s.mission_id, m.review_price_cents, case when v_open then 'awaiting_payment' else 'waitlist' end
  from public.skillfirms_missions m where m.id = v_s.mission_id
  on conflict (submission_id) do update set status = excluded.status, price_cents = excluded.price_cents
  returning * into v_order;
  update public.skillfirms_mission_submissions set status = 'expert_requested' where id = v_s.id;
  return to_jsonb(v_order);
end;
$$;
revoke all on function public.skillfirms_request_expert_review(uuid) from public, anon;
grant execute on function public.skillfirms_request_expert_review(uuid) to authenticated;

-- Admin (until Stripe is on): mark an order paid with credit.
create or replace function public.skillfirms_admin_credit_review(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  update public.skillfirms_review_orders set payment_status = 'credit', status = 'paid', paid_at = now()
  where id = p_order_id and status in ('waitlist', 'awaiting_payment') and payment_status = 'unpaid';
end;
$$;
revoke all on function public.skillfirms_admin_credit_review(uuid) from public, anon;
grant execute on function public.skillfirms_admin_credit_review(uuid) to authenticated;

create or replace function public.skillfirms_admin_review_orders()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.skillfirms_is_admin() then '[]'::jsonb else coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) end
  from (
    select jsonb_build_object('id', o.id, 'status', o.status, 'payment_status', o.payment_status, 'price_cents', o.price_cents,
      'created_at', o.created_at, 'paid_at', o.paid_at, 'due_at', o.due_at, 'mission', m.title, 'learner', p.display_name,
      'expert', e.display_name, 'payout_cents', o.expert_payout_cents) x
    from public.skillfirms_review_orders o
    join public.skillfirms_missions m on m.id = o.mission_id
    join public.profiles p on p.id = o.user_id
    left join public.skillfirms_experts e on e.id = o.expert_id
    order by o.created_at desc limit 200
  ) t;
$$;
revoke all on function public.skillfirms_admin_review_orders() from public, anon;
grant execute on function public.skillfirms_admin_review_orders() to authenticated;

-- 3. Expert work ------------------------------------------------------------------------------------
create or replace function public._skillfirms_my_expert()
returns public.skillfirms_experts language sql stable security definer set search_path = public as $$
  select * from public.skillfirms_experts where profile_id = auth.uid() and active;
$$;
revoke all on function public._skillfirms_my_expert() from public, anon, authenticated;

-- Blind queue: open paid orders in my skills (never my own), plus the ones I claimed.
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

create or replace function public.skillfirms_claim_review(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_e public.skillfirms_experts := public._skillfirms_my_expert();
begin
  if v_e.id is null then raise exception 'experts_only'; end if;
  if (select count(*) from public.skillfirms_review_orders where expert_id = v_e.id and status = 'claimed' and due_at >= now()) >= 5 then
    raise exception 'too_many_open: finish one of your reviews first'; end if;
  update public.skillfirms_review_orders o set status = 'claimed', expert_id = v_e.id, claimed_at = now(), due_at = now() + interval '3 days'
  where o.id = p_order_id and o.user_id <> v_e.profile_id
    and (o.status = 'paid' or (o.status = 'claimed' and o.due_at < now()))
    and exists (select 1 from public.skillfirms_mission_skills ms join public.skillfirms_expert_skills es on es.skill_id = ms.skill_id
                where ms.mission_id = o.mission_id and es.expert_id = v_e.id);
  if not found then raise exception 'not_available: someone else took it, or it isn''t in your skills'; end if;
end;
$$;
revoke all on function public.skillfirms_claim_review(uuid) from public, anon;
grant execute on function public.skillfirms_claim_review(uuid) to authenticated;

-- p_skill_scores: [{"skill_id": "...", "score": 0..1}] for the mission's skills.
create or replace function public.skillfirms_submit_review(p_order_id uuid, p_skill_scores jsonb, p_overall numeric, p_feedback text,
  p_strengths jsonb default '[]', p_improvements jsonb default '[]', p_passed boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_e public.skillfirms_experts := public._skillfirms_my_expert();
  v_o public.skillfirms_review_orders;
  v_m public.skillfirms_missions;
  v_sc record;
  v_pass boolean;
  v_cred uuid;
begin
  if v_e.id is null then raise exception 'experts_only'; end if;
  select * into v_o from public.skillfirms_review_orders where id = p_order_id for update;
  if v_o.id is null or v_o.expert_id is distinct from v_e.id or v_o.status <> 'claimed' or v_o.due_at < now() then
    raise exception 'not_your_review: claim it first (claims last 3 days)'; end if;
  if v_o.user_id = v_e.profile_id then raise exception 'not_your_review'; end if;
  if p_overall is null or p_overall < 0 or p_overall > 1 then raise exception 'overall_0_to_1'; end if;
  if char_length(btrim(coalesce(p_feedback, ''))) < 80 then raise exception 'feedback_too_short: write at least 80 characters of feedback'; end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_skill_scores, '[]')) x
      where (x->>'skill_id')::uuid in (select skill_id from public.skillfirms_mission_skills where mission_id = v_o.mission_id)
        and (x->>'score')::numeric between 0 and 1)
     <> (select count(*) from public.skillfirms_mission_skills where mission_id = v_o.mission_id) then
    raise exception 'score_every_skill: give a 0-100%% score for each of the mission''s skills'; end if;
  select * into v_m from public.skillfirms_missions where id = v_o.mission_id;
  v_pass := coalesce(p_passed, false) and p_overall >= 0.6;

  insert into public.skillfirms_mission_evaluations (submission_id, evaluator_type, expert_id, overall_score, feedback, strengths, improvements)
  values (v_o.submission_id, 'expert', v_e.id, p_overall, btrim(p_feedback), coalesce(p_strengths, '[]'), coalesce(p_improvements, '[]'));

  for v_sc in select (x->>'skill_id')::uuid skill_id, (x->>'score')::numeric score from jsonb_array_elements(p_skill_scores) x loop
    perform public.skillfirms_apply_skill_estimate(v_o.user_id, v_sc.skill_id,
      v_sc.score * (select coverage from public.skillfirms_mission_skills where mission_id = v_o.mission_id and skill_id = v_sc.skill_id),
      'expert_verified');
  end loop;

  if v_pass then
    v_cred := public.skillfirms_issue_or_update_credential(v_o.user_id, v_m.title, 'expert_verified', null, v_m.id, v_m.assessment_version);
  end if;

  update public.skillfirms_review_orders set status = 'reviewed', reviewed_at = now(),
    expert_payout_cents = round(price_cents * v_e.payout_share) where id = v_o.id;
  update public.skillfirms_mission_submissions set status = 'expert_reviewed' where id = v_o.submission_id;
  return jsonb_build_object('passed', v_pass, 'credential_id', v_cred);
end;
$$;
revoke all on function public.skillfirms_submit_review(uuid, jsonb, numeric, text, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.skillfirms_submit_review(uuid, jsonb, numeric, text, jsonb, jsonb, boolean) to authenticated;

create or replace function public.skillfirms_my_expert_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'expert', exists (select 1 from public.skillfirms_experts where profile_id = auth.uid() and active),
    'application', (select jsonb_build_object('status', status, 'created_at', created_at, 'admin_note', admin_note)
                    from public.skillfirms_expert_applications where profile_id = auth.uid() order by created_at desc limit 1),
    'experts_total', (select count(*) from public.skillfirms_experts where active and profile_id is not null)
  );
$$;
revoke all on function public.skillfirms_my_expert_status() from public, anon;
grant execute on function public.skillfirms_my_expert_status() to authenticated;

-- 4. Paid but not reviewed within 7 days -> refund due -----------------------------------------------
create or replace function public.skillfirms_mark_overdue_reviews()
returns integer language sql security definer set search_path = public as $$
  with x as (
    update public.skillfirms_review_orders set status = 'refund_due'
    where status in ('paid', 'claimed') and paid_at < now() - interval '7 days'
    returning 1
  ) select count(*)::int from x;
$$;
revoke all on function public.skillfirms_mark_overdue_reviews() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'skillfirms-overdue-reviews';
    perform cron.schedule('skillfirms-overdue-reviews', '17 * * * *', 'select public.skillfirms_mark_overdue_reviews()');
  end if;
end $$;
