-- Regression check for 0031: Skillfirms plans and timed checks. Rolled back.
-- carol (...03) is the learner; dave (...04) is admin; bob (...02) is an expert who doesn't own the course.
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000004', 'dave-admin-pl@example.test') on conflict (id) do nothing;
insert into public.profiles (id, username, display_name) values ('00000000-0000-0000-0000-000000000004', 'dave_admin_pl', 'Dave Admin') on conflict (id) do nothing;
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-000000000004';
update public.profiles set plan = 'free', plan_expires_at = null where id = '00000000-0000-0000-0000-000000000003';
insert into public.skillfirms_experts (profile_id, display_name, headline, active, approved_at)
values ('00000000-0000-0000-0000-000000000002', 'Bob Expert', 'Validation lead', true, now());

create temp table t_k on commit drop as
  select c.id as course, (select m.id from public.skillfirms_course_modules m where m.course_id = c.id
     and exists (select 1 from public.skillfirms_module_quiz_questions q where q.module_id = m.id) order by m.order_index limit 1) as module
  from public.skillfirms_courses c where c.status = 'published' and c.slug = 'gmp-fundamentals-for-validation';
grant select on t_k to authenticated, anon;
-- Make it a timed, paid course for the test.
update public.skillfirms_courses set check_minutes = 10, price_cents = 2000 where id = (select course from t_k);

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ declare r jsonb := public.my_skillfirms_plan(); begin
  if r->>'plan' <> 'free' or (r->>'tutor_per_day')::int <> 10 or (r->>'check_tries_per_day')::int <> 5 then raise exception 'FAIL: %', r; end if;
  raise notice 'PASS: a new learner is on Free (10 tutor questions, 5 tries a day)';
end $$;
do $$ begin
  insert into public.skillfirms_memberships (user_id, plan, status) values ('00000000-0000-0000-0000-000000000003', 'mastery', 'active');
  raise exception 'FAIL: gave myself a plan';
exception when insufficient_privilege then raise notice 'PASS: nobody can give themselves a plan';
end $$;
do $$ declare r jsonb := public.skillfirms_join_plan('scholar', 'yearly'); begin
  if r->>'status' <> 'waitlist' or public.my_skillfirms_plan()->>'plan' <> 'free' then raise exception 'FAIL: %', r; end if;
  raise notice 'PASS: with payments off, joining Scholar is a waiting list (no charge, no plan yet)';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select public.skillfirms_admin_set_membership('00000000-0000-0000-0000-000000000003', 1);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ declare r jsonb := public.my_skillfirms_plan(); begin
  if r->>'plan' <> 'scholar' or (r->>'check_tries_per_day')::int <> 10 or (r->>'expert_discount_pct')::int <> 15 or (r->>'via_talfirms')::boolean then raise exception 'FAIL: %', r; end if;
  raise notice 'PASS: switched on, Scholar gives 10 tries a day and 15%% off expert courses';
end $$;
do $$ declare r jsonb; begin
  r := public.skillfirms_buy_course((select course from t_k));
  if (r->>'price_cents')::int <> 1700 or (r->>'list_price_cents')::int <> 2000 then raise exception 'FAIL: %', r; end if;
  raise notice 'PASS: Scholar pays 15%% less for an expert course';
end $$;
reset role;
update public.profiles set plan = 'ultra' where id = '00000000-0000-0000-0000-000000000003';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ declare r jsonb := public.my_skillfirms_plan(); begin
  if r->>'plan' <> 'mastery' or not (r->>'via_talfirms')::boolean or (r->>'tutor_per_day')::int <> 150 then raise exception 'FAIL: %', r; end if;
  raise notice 'PASS: Talfirms Ultra includes Mastery';
end $$;
reset role;
update public.profiles set plan = 'free' where id = '00000000-0000-0000-0000-000000000003';
-- give carol access to the paid course so she can enrol
update public.skillfirms_course_purchases set status = 'paid', payment_status = 'credit' where user_id = '00000000-0000-0000-0000-000000000003';
insert into public.skillfirms_enrollments (user_id, course_id) values ('00000000-0000-0000-0000-000000000003', (select course from t_k)) on conflict do nothing;
update public.skillfirms_course_purchases set payment_status = 'unpaid', status = 'waitlist' where user_id = '00000000-0000-0000-0000-000000000003';
set role authenticated;

-- Timed checks
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ begin
  perform public.skillfirms_studio_set_check_minutes((select course from t_k), 5);
  raise exception 'FAIL: another expert changed the timer';
exception when raise_exception then
  if sqlerrm not like 'not_yours%' then raise; end if;
  raise notice 'PASS: only the course''s own expert sets its time limit';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ declare n int; begin
  select count(*) into n from public.skillfirms_module_quiz_questions where module_id = (select module from t_k);
  if n <> 0 then raise exception 'FAIL: % questions visible before starting the clock', n; end if;
  raise notice 'PASS: a timed check''s questions stay hidden until you press start';
end $$;
do $$ begin
  perform public.skillfirms_submit_quiz((select module from t_k), '{}'::jsonb);
  raise exception 'FAIL: submitted without starting';
exception when raise_exception then
  if sqlerrm not like 'start_first%' then raise; end if;
  raise notice 'PASS: can''t submit a timed check without starting the clock';
end $$;
do $$ declare r jsonb := public.skillfirms_start_check((select module from t_k)); n int; begin
  if not (r->>'timed')::boolean or (r->>'seconds_left')::int not between 590 and 600 then raise exception 'FAIL: %', r; end if;
  select count(*) into n from public.skillfirms_module_quiz_questions where module_id = (select module from t_k);
  if n = 0 then raise exception 'FAIL: questions still hidden after start'; end if;
  if (public.skillfirms_start_check((select module from t_k))->>'started_at') <> r->>'started_at' then raise exception 'FAIL: reloading restarted the clock'; end if;
  raise notice 'PASS: start shows the questions with a 10-minute clock, and reloading doesn''t reset it';
end $$;
reset role;
update public.skillfirms_check_starts set ends_at = now() - interval '2 minutes' where user_id = '00000000-0000-0000-0000-000000000003';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  perform public.skillfirms_submit_quiz((select module from t_k), '{}'::jsonb);
  raise exception 'FAIL: accepted after time ran out';
exception when raise_exception then
  if sqlerrm not like 'time_up%' then raise; end if;
  raise notice 'PASS: answers after the time runs out are refused';
end $$;
do $$ declare r jsonb := public.skillfirms_start_check((select module from t_k)); s numeric; begin
  s := public.skillfirms_submit_quiz((select module from t_k), (select jsonb_object_agg(id::text, 0) from public.skillfirms_module_quiz_questions where module_id = (select module from t_k)));
  if s is null then raise exception 'FAIL: no score'; end if;
  if exists (select 1 from public.skillfirms_module_quiz_questions where module_id = (select module from t_k)) then raise exception 'FAIL: questions still visible after submitting'; end if;
  raise notice 'PASS: in time it''s graded, and the questions hide again afterwards';
end $$;
rollback;
