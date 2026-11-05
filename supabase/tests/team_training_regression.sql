-- Regression check for 0028: team training. Rolled back.
-- bob (...02) manages "Teamtrain Pharma"; alice (...01) and carol (...03) are staff.
begin;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
create temp table t_co on commit drop as select id from public.register_company('Teamtrain Pharma', 'teamtrain-pharma', null, null, null, 'direct_employer');
reset role;
grant select on t_co to authenticated;
update public.companies set training_seat_limit = 1 where id = (select id from t_co);
create temp table t_k (k text primary key, v text) on commit drop;
grant all on t_k to authenticated;
create temp table t_c on commit drop as select id from public.skillfirms_courses where slug = 'gmp-fundamentals-for-validation';
grant select on t_c to authenticated;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into t_k values ('code', public.skillfirms_team_invite_link((select id from t_co))),
                       ('code2', public.skillfirms_team_invite_link((select id from t_co)));
do $$ begin
  if (select v from t_k where k = 'code') <> (select v from t_k where k = 'code2') then raise exception 'FAIL: link changes each time'; end if;
  raise notice 'PASS: a manager gets one stable invite link';
end $$;
select public.skillfirms_team_assign((select id from t_co), (select id from t_c), null, current_date - 1);

-- alice joins and is enrolled in the assigned course.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.skillfirms_team_join((select v from t_k where k = 'code'));
do $$ begin
  if not exists (select 1 from public.skillfirms_enrollments where user_id = '00000000-0000-0000-0000-000000000001' and course_id = (select id from t_c)) then
    raise exception 'FAIL: joiner not enrolled in the assigned course'; end if;
  if jsonb_array_length(public.skillfirms_my_assignments()) <> 1 then raise exception 'FAIL: assignment not shown to learner'; end if;
  raise notice 'PASS: joining enrols you in the team''s courses and shows them as assigned';
  perform public.skillfirms_team_dashboard((select id from t_co));
  raise exception 'FAIL: staff saw the training record';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  if sqlerrm <> 'managers_only' then raise; end if;
  raise notice 'PASS: only managers see the training record';
end $$;

-- Seat limit (1): carol can't join.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  perform public.skillfirms_team_join((select v from t_k where k = 'code'));
  raise exception 'FAIL: joined past the seat limit';
exception when raise_exception then
  if sqlerrm not like 'seats_full%' then raise; end if;
  raise notice 'PASS: seats are enforced';
end $$;
do $$ begin
  perform 1 from public.skillfirms_team_members;
  raise exception 'FAIL: team table readable directly';
exception when insufficient_privilege then raise notice 'PASS: team tables are only reachable through the checked functions';
end $$;

-- The record: only assigned courses; overdue when past due without certificate; certificate once earned.
reset role;
insert into public.skillfirms_enrollments (user_id, course_id) select '00000000-0000-0000-0000-000000000001', id from public.skillfirms_courses where slug = 'sql-for-analysts' on conflict do nothing;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ declare d jsonb; c jsonb; begin
  d := public.skillfirms_team_dashboard((select id from t_co));
  if jsonb_array_length(d->'members') <> 1 then raise exception 'FAIL: members wrong: %', d; end if;
  c := d->'members'->0->'courses';
  if jsonb_array_length(c) <> 1 or c->0->>'slug' <> 'gmp-fundamentals-for-validation' then raise exception 'FAIL: record shows unassigned courses: %', c; end if;
  if not (c->0->>'overdue')::boolean then raise exception 'FAIL: overdue not flagged'; end if;
  raise notice 'PASS: the record shows only assigned courses and flags overdue ones';
end $$;
reset role;
insert into public.skillfirms_credentials (user_id, credential_code, credential_name, source_type, course_id, assessment_version)
values ('00000000-0000-0000-0000-000000000001', 'SF-TEAM0001', 'GMP Fundamentals', 'assessment_based', (select id from t_c), 'v1');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ declare c jsonb; begin
  c := public.skillfirms_team_dashboard((select id from t_co))->'members'->0->'courses'->0;
  if c->'certificate'->>'code' <> 'SF-TEAM0001' or (c->>'overdue')::boolean then raise exception 'FAIL: certificate not in record: %', c; end if;
  raise notice 'PASS: certificates show in the record (with a code anyone can verify)';
end $$;

-- alice leaves: the company no longer sees her.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.skillfirms_team_leave((select id from t_co));
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ begin
  if jsonb_array_length(public.skillfirms_team_dashboard((select id from t_co))->'members') <> 0 then raise exception 'FAIL: left member still visible'; end if;
  raise notice 'PASS: leaving the team removes you from the company''s record';
end $$;
reset role;
rollback;
