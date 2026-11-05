-- Regression check for 0031 + 0032: tutor question packs, expert prices and
-- splits, team-training pool, timed checks. Rolled back.
-- carol (...03) is the learner; dave (...04) is admin; bob (...02) is the course's expert.
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000004', 'dave-admin-pl@example.test') on conflict (id) do nothing;
insert into public.profiles (id, username, display_name) values ('00000000-0000-0000-0000-000000000004', 'dave_admin_pl', 'Dave Admin') on conflict (id) do nothing;
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-000000000004';
insert into public.skillfirms_experts (profile_id, display_name, headline, active, approved_at)
values ('00000000-0000-0000-0000-000000000002', 'Bob Expert', 'Validation lead', true, now());

create temp table t_k on commit drop as
  select c.id as course, (select m.id from public.skillfirms_course_modules m where m.course_id = c.id
     and exists (select 1 from public.skillfirms_module_quiz_questions q where q.module_id = m.id) order by m.order_index limit 1) as module,
    (select ref_code from public.skillfirms_experts where profile_id = '00000000-0000-0000-0000-000000000002') as ref
  from public.skillfirms_courses c where c.status = 'published' and c.slug = 'gmp-fundamentals-for-validation';
grant select on t_k to authenticated, anon;
create temp table t_p (id uuid) on commit drop;
grant all on t_p to authenticated;
-- Bob's paid, timed course for the test.
update public.skillfirms_courses set check_minutes = 10, price_cents = 2000, taught_by = 'expert',
  expert_id = (select id from public.skillfirms_experts where profile_id = '00000000-0000-0000-0000-000000000002')
where id = (select course from t_k);

-- Tutor packs ---------------------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ declare n int; begin
  select count(*) into n from public.skillfirms_credit_packs;
  if n <> 3 or (select price_cents from public.skillfirms_credit_packs where pack = 'q20') <> 199 then raise exception 'FAIL: packs %', n; end if;
  raise notice 'PASS: three tutor packs (20 / 50 / 100 questions)';
end $$;
do $$ begin
  insert into public.skillfirms_tutor_wallets (user_id, balance) values ('00000000-0000-0000-0000-000000000003', 999);
  raise exception 'FAIL: gave myself questions';
exception when insufficient_privilege then raise notice 'PASS: nobody can add questions to their own balance';
end $$;
do $$ declare r jsonb := public.skillfirms_buy_credits('q50'); begin
  if r->>'status' <> 'waitlist' or (public.my_tutor_wallet()->>'balance')::int <> 0 then raise exception 'FAIL: %', r; end if;
  insert into t_p values ((r->>'id')::uuid);
  raise notice 'PASS: with payments off, buying a pack is a waiting list (no charge, no questions yet)';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select public.skillfirms_admin_grant_credits((select id from t_p));
do $$ begin
  perform public.skillfirms_admin_grant_credits((select id from t_p));
  raise exception 'FAIL: granted twice';
exception when raise_exception then
  if sqlerrm not like 'already_done%' then raise; end if;
  raise notice 'PASS: a paid pack is added once, never twice';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  if (public.my_tutor_wallet()->>'balance')::int <> 50 then raise exception 'FAIL: balance %', public.my_tutor_wallet(); end if;
  raise notice 'PASS: once paid, the 50 questions are saved to the balance';
end $$;
do $$ begin
  perform public._skillfirms_take_credit('00000000-0000-0000-0000-000000000003');
  raise exception 'FAIL: learner spent a credit directly';
exception when insufficient_privilege then raise notice 'PASS: only the tutor can use a saved question';
end $$;
reset role;
select public._skillfirms_take_credit('00000000-0000-0000-0000-000000000003');
do $$ begin
  if (select balance from public.skillfirms_tutor_wallets where user_id = '00000000-0000-0000-0000-000000000003') <> 49 then raise exception 'FAIL: not taken'; end if;
  raise notice 'PASS: each tutor answer past the free ones uses one saved question';
end $$;

-- Expert prices and splits --------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select public.skillfirms_studio_set_price((select course from t_k limit 1), 4900);
do $$ begin
  perform public.skillfirms_studio_set_price((select course from t_k limit 1), 50);
  raise exception 'FAIL: odd price accepted';
exception when raise_exception then
  if sqlerrm not like 'bad_price%' then raise; end if;
  raise notice 'PASS: the expert changes the price of a live course any time ($9-$199 or free)';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  perform public.skillfirms_studio_set_price((select course from t_k limit 1), 900);
  raise exception 'FAIL: learner changed the price';
exception when raise_exception then
  if sqlerrm not like 'not_yours%' then raise; end if;
  raise notice 'PASS: only the course''s expert can change its price';
end $$;
do $$ declare r jsonb; begin
  r := public.skillfirms_buy_course_v2((select course from t_k limit 1), 'wrongcode');
  if r->>'channel' <> 'marketplace' or (r->>'price_cents')::int <> 4900 then raise exception 'FAIL: %', r; end if;
  r := public.skillfirms_buy_course_v2((select course from t_k limit 1), (select ref from t_k limit 1));
  if r->>'channel' <> 'expert_link' then raise exception 'FAIL: %', r; end if;
  delete from t_p; insert into t_p values ((r->>'id')::uuid);
  raise notice 'PASS: the expert''s own link marks the sale as theirs; a wrong code doesn''t';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select public.skillfirms_admin_grant_course((select id from t_p));
reset role;
do $$ begin
  if (select instructor_share_cents from public.skillfirms_course_purchases where user_id = '00000000-0000-0000-0000-000000000003' and course_id = (select course from t_k limit 1)) <> 4753 then
    raise exception 'FAIL: own-link share not 97%%'; end if;
  if round(4900 * public.skillfirms_expert_share('marketplace')) <> 3430 then raise exception 'FAIL: marketplace share not 70%%'; end if;
  raise notice 'PASS: experts keep 97%% through their own link and 70%% when Skillfirms finds the student';
end $$;

-- Timed checks (carol has access now) ---------------------------------------------------------------
insert into public.skillfirms_enrollments (user_id, course_id) values ('00000000-0000-0000-0000-000000000003', (select course from t_k limit 1)) on conflict do nothing;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  perform public.skillfirms_studio_set_check_minutes((select course from t_k limit 1), 5);
  raise exception 'FAIL: a learner changed the timer';
exception when raise_exception then
  if sqlerrm not like 'not_yours%' then raise; end if;
  raise notice 'PASS: only the course''s own expert sets its time limit';
end $$;
do $$ declare n int; begin
  select count(*) into n from public.skillfirms_module_quiz_questions where module_id = (select module from t_k limit 1);
  if n <> 0 then raise exception 'FAIL: % questions visible before starting the clock', n; end if;
  raise notice 'PASS: a timed check''s questions stay hidden until you press start';
end $$;
do $$ begin
  perform public.skillfirms_submit_quiz((select module from t_k limit 1), '{}'::jsonb);
  raise exception 'FAIL: submitted without starting';
exception when raise_exception then
  if sqlerrm not like 'start_first%' then raise; end if;
  raise notice 'PASS: can''t submit a timed check without starting the clock';
end $$;
do $$ declare r jsonb := public.skillfirms_start_check((select module from t_k limit 1)); n int; begin
  if not (r->>'timed')::boolean or (r->>'seconds_left')::int not between 590 and 600 then raise exception 'FAIL: %', r; end if;
  select count(*) into n from public.skillfirms_module_quiz_questions where module_id = (select module from t_k limit 1);
  if n = 0 then raise exception 'FAIL: questions still hidden after start'; end if;
  if (public.skillfirms_start_check((select module from t_k limit 1))->>'started_at') <> r->>'started_at' then raise exception 'FAIL: reloading restarted the clock'; end if;
  raise notice 'PASS: start shows the questions with a 10-minute clock, and reloading doesn''t reset it';
end $$;
reset role;
update public.skillfirms_check_starts set ends_at = now() - interval '2 minutes' where user_id = '00000000-0000-0000-0000-000000000003';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  perform public.skillfirms_submit_quiz((select module from t_k limit 1), '{}'::jsonb);
  raise exception 'FAIL: accepted after time ran out';
exception when raise_exception then
  if sqlerrm not like 'time_up%' then raise; end if;
  raise notice 'PASS: answers after the time runs out are refused';
end $$;
do $$ declare r jsonb := public.skillfirms_start_check((select module from t_k limit 1)); s numeric; begin
  s := public.skillfirms_submit_quiz((select module from t_k limit 1), (select jsonb_object_agg(id::text, 0) from public.skillfirms_module_quiz_questions where module_id = (select module from t_k limit 1)));
  if s is null then raise exception 'FAIL: no score'; end if;
  if exists (select 1 from public.skillfirms_module_quiz_questions where module_id = (select module from t_k limit 1)) then raise exception 'FAIL: questions still visible after submitting'; end if;
  raise notice 'PASS: in time it''s graded, and the questions hide again afterwards';
end $$;

-- Team-training pool ------------------------------------------------------------------------------
reset role;
do $$ declare v_company uuid; r jsonb; begin
  select id into v_company from public.companies limit 1;
  insert into public.skillfirms_team_members (company_id, profile_id) values (v_company, '00000000-0000-0000-0000-000000000003') on conflict do nothing;
  insert into public.skillfirms_team_assignments (company_id, course_id) values (v_company, (select course from t_k limit 1));
  update public.skillfirms_module_progress set completed_at = now()
    where module_id = (select module from t_k limit 1)
      and enrollment_id = (select id from public.skillfirms_enrollments where user_id = '00000000-0000-0000-0000-000000000003' and course_id = (select course from t_k limit 1));
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
  r := public.skillfirms_admin_team_pool(current_date, 10000);
  if (r->>'pool_cents')::int <> 5000 or jsonb_array_length(r->'experts') <> 1 or (r->'experts'->0->>'share_cents')::int <> 5000 then raise exception 'FAIL: %', r; end if;
  raise notice 'PASS: half of team-training money goes to experts, split by their learners'' minutes';
end $$;
do $$ begin
  update public.skillfirms_courses set price_cents = 0 where id = (select course from t_k limit 1);
  raise exception 'FAIL: an expert course was made free';
exception when raise_exception then
  if sqlerrm not like 'expert_courses_are_paid%' then raise; end if;
  raise notice 'PASS: expert courses are always paid; only AI-made basics are free';
end $$;
rollback;
