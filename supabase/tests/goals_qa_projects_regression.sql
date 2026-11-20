-- 0034: weekly goal, lesson Q&A, path projects with peer review.
begin;
create temp table k (role text, id uuid);
grant select on k to authenticated, anon;
insert into k select 'a', id from public.profiles order by created_at limit 1;
insert into k select 'b', id from public.profiles where id <> (select id from k where role = 'a') order by created_at limit 1;
insert into k select 'c', id from public.profiles where id not in (select id from k) order by created_at limit 1;
insert into k select 'mod', m.id from public.skillfirms_course_modules m join public.skillfirms_courses c on c.id = m.course_id where c.status = 'published' limit 1;
insert into k select 'role', role_id from public.skillfirms_path_projects limit 1;
-- b and c have each passed a lesson check (needed to review).
insert into public.skillfirms_enrollments (user_id, course_id)
  select x.id, (select course_id from public.skillfirms_course_modules where id = (select id from k where role = 'mod')) from k x where x.role in ('b', 'c')
  on conflict do nothing;
insert into public.skillfirms_module_progress (enrollment_id, module_id, completed_at)
  select e.id, (select id from k where role = 'mod'), now() from public.skillfirms_enrollments e
  where e.user_id in (select id from k where role in ('b', 'c')) and e.course_id = (select course_id from public.skillfirms_course_modules where id = (select id from k where role = 'mod'))
  on conflict (enrollment_id, module_id) do update set completed_at = now();
delete from public.skillfirms_project_submissions where user_id in (select id from k);

set role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from k where role = 'a'), true);
do $$
declare w jsonb;
begin
  insert into public.skillfirms_learning_goals (user_id, days_per_week) values ((select id from k where role = 'a'), 1)
    on conflict (user_id) do update set days_per_week = 1;
  perform public.skillfirms_log_learning_day();
  perform public.skillfirms_log_learning_day();
  w := public.skillfirms_my_week();
  if (w->>'goal')::int <> 1 or jsonb_array_length(w->'days') <> 1 or (w->>'weeks_in_a_row')::int < 1 then raise exception 'FAIL: week %', w; end if;
  raise notice 'PASS: weekly goal counts each day once and meets the goal';
end $$;

create temp table ids (name text, id uuid);
grant all on ids to authenticated;
do $$
declare q uuid; a uuid;
begin
  q := public.skillfirms_ask_question((select id from k where role = 'mod'), 'What does IQ prove that OQ does not?');
  perform public.skillfirms_answer_question(q, 'AI says: installation against the specification.', true);
  if public.skillfirms_answer_question(q, 'second AI answer', true) is not null then raise exception 'FAIL: two AI answers'; end if;
  insert into ids values ('q', q);
  raise notice 'PASS: the asker can add one AI tutor answer';
end $$;
select set_config('request.jwt.claim.sub', (select id::text from k where role = 'b'), true);
do $$
declare a uuid; t jsonb;
begin
  begin
    perform public.skillfirms_answer_question((select id from ids where name = 'q'), 'x', true);
    raise exception 'FAIL: someone else posted an AI answer';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  a := public.skillfirms_answer_question((select id from ids where name = 'q'), 'IQ proves it is installed as specified; OQ that it operates across its ranges.');
  insert into ids values ('a', a);
  t := public.skillfirms_lesson_thread((select id from k where role = 'mod'));
  if jsonb_array_length(t->0->'answers') <> 2 then raise exception 'FAIL: thread %', t; end if;
  raise notice 'PASS: people answer, thread shows AI and person answers';
end $$;
select set_config('request.jwt.claim.sub', (select id::text from k where role = 'a'), true);
do $$ begin
  perform public.skillfirms_vote_answer((select id from ids where name = 'a'), true);
  perform public.skillfirms_vote_answer((select id from ids where name = 'a'), true);
  if (select (x->>'helpful')::int from jsonb_array_elements(public.skillfirms_lesson_thread((select id from k where role = 'mod'))->0->'answers') x where (x->>'id')::uuid = (select id from ids where name = 'a')) <> 1 then raise exception 'FAIL: votes'; end if;
  raise notice 'PASS: one helpful vote per person';
end $$;
select set_config('request.jwt.claim.sub', (select id::text from k where role = 'b'), true);
do $$ begin
  perform public.skillfirms_vote_answer((select id from ids where name = 'a'), true);
  if (select (x->>'helpful')::int from jsonb_array_elements(public.skillfirms_lesson_thread((select id from k where role = 'mod'))->0->'answers') x where (x->>'id')::uuid = (select id from ids where name = 'a')) <> 1 then raise exception 'FAIL: voted own answer'; end if;
  raise notice 'PASS: you can''t vote for your own answer';
end $$;

-- Projects
select set_config('request.jwt.claim.sub', (select id::text from k where role = 'a'), true);
do $$
declare s uuid;
begin
  s := public.skillfirms_submit_project((select id from k where role = 'role'), repeat('I mapped the room with 15 probes over 72 hours. ', 3), 'https://example.com/work');
  insert into ids values ('s', s);
  begin
    perform public.skillfirms_review_project(s, 'pass', 'Looks great, very thorough work overall.');
    raise exception 'FAIL: reviewed own work';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  raise notice 'PASS: submit a project, never review your own';
end $$;
select set_config('request.jwt.claim.sub', (select id::text from k where role = 'b'), true);
do $$ begin
  if public.skillfirms_review_project((select id from ids where name = 's'), 'pass', 'Clear acceptance criteria and a justified mapping plan.') <> 'in_review' then raise exception 'FAIL: one review decided it'; end if;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from k where role = 'c'), true);
do $$ begin
  if public.skillfirms_review_project((select id from ids where name = 's'), 'pass', 'Risks are real and controlled; good probe placement.') <> 'passed' then raise exception 'FAIL: two passes did not pass it'; end if;
  raise notice 'PASS: two peer passes pass the project';
end $$;
reset role;
rollback;
