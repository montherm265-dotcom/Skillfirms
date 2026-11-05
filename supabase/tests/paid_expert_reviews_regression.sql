-- Regression check for 0027: real experts, blind paid reviews. Rolled back.
-- alice (...01) learner, bob (...02) becomes an expert, carol (...03) tries to cheat, dave (...04) is admin.
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000004', 'dave-admin-rv@example.test') on conflict (id) do nothing;
insert into public.profiles (id, username, display_name) values ('00000000-0000-0000-0000-000000000004', 'dave_admin_rv', 'Dave Admin') on conflict (id) do nothing;
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-000000000004';
create temp table t_m on commit drop as select id from public.skillfirms_missions where slug = 'write-a-urs-clean-steam-generator';
grant select on t_m to authenticated;
create temp table t_ids (k text primary key, v uuid) on commit drop;
grant all on t_ids to authenticated;

-- carol can't make herself an expert.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  insert into public.skillfirms_experts (profile_id, display_name, headline) values ('00000000-0000-0000-0000-000000000003', 'Carol', 'Expert');
  raise exception 'FAIL: user made herself an expert';
exception when insufficient_privilege then raise notice 'PASS: nobody can make themselves an expert';
end $$;

-- alice submits work.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into public.skillfirms_mission_submissions (user_id, mission_id, submission_text)
values ('00000000-0000-0000-0000-000000000001', (select id from t_m), repeat('A careful URS with requirements, risks and acceptance criteria. ', 6));
insert into t_ids select 'sub', id from public.skillfirms_mission_submissions where user_id = '00000000-0000-0000-0000-000000000001';

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  if exists (select 1 from public.skillfirms_mission_submissions where user_id = '00000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL: someone else can read the learner''s work'; end if;
  raise notice 'PASS: learners'' work is private';
end $$;

-- Paid reviews are off: the request waits, nothing charged.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ declare r jsonb; begin
  r := public.skillfirms_request_expert_review((select v from t_ids where k = 'sub'));
  if r->>'status' <> 'waitlist' or r->>'payment_status' <> 'unpaid' or (r->>'price_cents')::int <> 3900 then raise exception 'FAIL: %', r; end if;
  raise notice 'PASS: with reviews off (or no expert), the request joins the waiting list and costs nothing';
end $$;
do $$ begin
  update public.skillfirms_mission_submissions set status = 'expert_reviewed' where id = (select v from t_ids where k = 'sub');
  raise exception 'FAIL: learner marked own work as expert-reviewed';
exception when raise_exception then
  if sqlerrm not like 'status_via_orders%' then raise; end if;
  raise notice 'PASS: a learner can''t mark their own work as reviewed';
end $$;

-- bob applies; admin approves.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into t_ids select 'app', public.skillfirms_apply_as_expert('Validation lead, 12 years',
  repeat('I have written and reviewed URS documents for sterile facilities. ', 3), 12,
  (select array_agg(skill_id) from public.skillfirms_mission_skills where mission_id = (select id from t_m)), null);
do $$ begin
  perform public.skillfirms_expert_queue();
  raise exception 'FAIL: applicant used the expert queue';
exception when raise_exception then
  if sqlerrm <> 'experts_only' then raise; end if;
  raise notice 'PASS: applying isn''t enough to review';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select public.skillfirms_review_expert_application((select v from t_ids where k = 'app'), 'approve', null);

-- Reviews switched on; admin credits alice's order.
reset role;
update public.app_flags set enabled = true where key = 'skillfirms_paid_reviews';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ declare r jsonb; begin
  r := public.skillfirms_mission_review_offer((select id from t_m));
  if not (r->>'open')::boolean or (r->>'experts')::int < 1 then raise exception 'FAIL: offer not open: %', r; end if;
  r := public.skillfirms_request_expert_review((select v from t_ids where k = 'sub'));
  if r->>'status' <> 'awaiting_payment' then raise exception 'FAIL: %', r; end if;
  raise notice 'PASS: once open, the request waits for payment';
end $$;
insert into t_ids select 'order', id from public.skillfirms_review_orders where submission_id = (select v from t_ids where k = 'sub');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select public.skillfirms_admin_credit_review((select v from t_ids where k = 'order'));

-- bob sees it blind, claims, reviews.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ declare q jsonb; o uuid; begin
  q := public.skillfirms_expert_queue();
  if jsonb_array_length(q->'available') <> 1 then raise exception 'FAIL: paid order not in queue: %', q; end if;
  if q::text like '%Alice%' or q::text like '%alice%' then raise exception 'FAIL: learner named in queue'; end if;
  o := (q->'available'->0->>'id')::uuid;
  perform public.skillfirms_claim_review(o);
  q := public.skillfirms_expert_queue();
  if q->'mine'->0->>'submission' is null then raise exception 'FAIL: claimed work not visible to the expert'; end if;
  begin
    perform public.skillfirms_submit_review(o, '[]'::jsonb, 0.8, repeat('Good work. ', 10), '[]', '[]', true);
    raise exception 'FAIL: review without per-skill scores accepted';
  exception when raise_exception then
    if sqlerrm not like 'score_every_skill%' then raise; end if;
  end;
  perform public.skillfirms_submit_review(o,
    (select jsonb_agg(jsonb_build_object('skill_id', skill_id, 'score', 0.8)) from public.skillfirms_mission_skills where mission_id = (select id from t_m)),
    0.8, repeat('Clear scope, testable requirements, good risk links. ', 3), '["Clear"]', '["Add alarms"]', true);
  raise notice 'PASS: expert sees the work blind, must score every skill, then submits';
end $$;

reset role;
do $$ begin
  if not exists (select 1 from public.skillfirms_credentials where user_id = '00000000-0000-0000-0000-000000000001'
                 and mission_id = (select id from t_m) and source_type = 'expert_verified' and status = 'active_verified') then
    raise exception 'FAIL: no expert verified credential'; end if;
  if (select expert_payout_cents from public.skillfirms_review_orders where submission_id = (select v from t_ids where k = 'sub')) <> 2340 then
    raise exception 'FAIL: payout not 60%%'; end if;
  raise notice 'PASS: a pass issues the expert-verified credential and the expert earns 60%%';
end $$;

-- An expert can't review their own work.
insert into public.skillfirms_mission_submissions (user_id, mission_id, submission_text)
values ('00000000-0000-0000-0000-000000000002', (select id from t_m), repeat('My own URS draft with requirements and risks. ', 6));
insert into public.skillfirms_review_orders (submission_id, user_id, mission_id, price_cents, status, payment_status, paid_at)
select id, user_id, mission_id, 3900, 'paid', 'credit', now() from public.skillfirms_mission_submissions where user_id = '00000000-0000-0000-0000-000000000002';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ begin
  if jsonb_array_length(public.skillfirms_expert_queue()->'available') <> 0 then raise exception 'FAIL: own work offered to self'; end if;
  perform public.skillfirms_claim_review((select id from public.skillfirms_review_orders where user_id = '00000000-0000-0000-0000-000000000002'));
  raise exception 'FAIL: claimed own work';
exception when raise_exception then
  if sqlerrm not like 'not_available%' then raise; end if;
  raise notice 'PASS: experts never review their own work';
end $$;
do $$ begin
  perform public.skillfirms_expert_review_submission((select v from t_ids where k = 'sub'), 1, 'x', '[]', '[]');
  raise exception 'FAIL: old review shortcut still works';
exception when insufficient_privilege then raise notice 'PASS: the old any-submission review shortcut is closed';
end $$;
reset role;
rollback;
