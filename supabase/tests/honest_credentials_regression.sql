-- Regression check for 0024: lessons, no self-written scores, credentials
-- only for a whole course. Rolled back. carol (...03) is the learner.
begin;
create temp table t_course on commit drop as select id from public.skillfirms_courses where slug = 'agile-methodology-in-practice';
create temp table t_mods on commit drop as select id, order_index from public.skillfirms_course_modules where course_id = (select id from t_course) order by order_index;
-- One question per lesson; the right answer is always choice 1.
insert into public.skillfirms_module_quiz_questions (module_id, order_index, question, choices, correct_index)
select id, 0, 'Question for lesson ' || order_index, '["a","b","c"]'::jsonb, 1 from t_mods;
grant select on t_course, t_mods to authenticated, anon;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
insert into public.skillfirms_enrollments (user_id, course_id) values ('00000000-0000-0000-0000-000000000003', (select id from t_course));
create temp table t_enr on commit drop as select id from public.skillfirms_enrollments where user_id = '00000000-0000-0000-0000-000000000003' and course_id = (select id from t_course);

do $$ begin
  begin
    insert into public.skillfirms_module_progress (enrollment_id, module_id, completed_at, quiz_score) values ((select id from t_enr), (select id from t_mods order by order_index limit 1), now(), 1);
    raise exception 'FAIL: wrote my own quiz score';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.skillfirms_module_progress (enrollment_id, module_id, completed_at) values ((select id from t_enr), (select id from t_mods order by order_index limit 1), now());
    raise exception 'FAIL: completed a lesson without passing its check';
  exception when raise_exception then
    if sqlerrm not like 'take_the_check%' then raise; end if;
  end;
  begin
    update public.skillfirms_enrollments set progress_percent = 100, status = 'completed' where id = (select id from t_enr);
    raise exception 'FAIL: set my own course progress';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: no self-written scores, completions or progress';
end $$;

-- Fail a check: not complete.
do $$ declare m uuid := (select id from t_mods order by order_index limit 1); q uuid; begin
  select id into q from public.skillfirms_module_quiz_questions where module_id = m;
  perform public.skillfirms_submit_quiz(m, jsonb_build_object(q::text, 0));
  if exists (select 1 from public.skillfirms_module_progress where module_id = m and completed_at is not null) then raise exception 'FAIL: failed check counted as complete'; end if;
  raise notice 'PASS: a failed check doesn''t complete the lesson';
end $$;

-- Pass all but the last lesson: no credential yet.
do $$ declare r record; q uuid; begin
  for r in select id from t_mods order by order_index offset 0 limit (select count(*) - 1 from t_mods) loop
    select id into q from public.skillfirms_module_quiz_questions where module_id = r.id;
    perform public.skillfirms_submit_quiz(r.id, jsonb_build_object(q::text, 1));
  end loop;
  if exists (select 1 from public.skillfirms_credentials where user_id = '00000000-0000-0000-0000-000000000003' and course_id = (select id from t_course)) then
    raise exception 'FAIL: credential issued before the whole course was done';
  end if;
  raise notice 'PASS: no course credential for part of a course';
end $$;

-- Pass the last one: credential, and progress is 100%.
do $$ declare m uuid := (select id from t_mods order by order_index desc limit 1); q uuid; begin
  select id into q from public.skillfirms_module_quiz_questions where module_id = m;
  perform public.skillfirms_submit_quiz(m, jsonb_build_object(q::text, 1));
  if not exists (select 1 from public.skillfirms_credentials where user_id = '00000000-0000-0000-0000-000000000003' and course_id = (select id from t_course) and status = 'active_verified') then
    raise exception 'FAIL: no credential after passing every lesson';
  end if;
  if (select progress_percent from public.skillfirms_enrollments where id = (select id from t_enr)) <> 100 then raise exception 'FAIL: progress not computed'; end if;
  raise notice 'PASS: credential after every lesson is passed; progress computed by the database';
end $$;
reset role;

-- Lessons: ready ones are public, unfinished ones aren't.
insert into public.skillfirms_lessons (module_id, status, body) values ((select id from t_mods order by order_index limit 1), 'ready', '{"summary":"x"}');
insert into public.skillfirms_lessons (module_id, status) values ((select id from t_mods order by order_index desc limit 1), 'generating');
set role anon;
do $$ begin
  if (select count(*) from public.skillfirms_lessons where module_id in (select id from t_mods)) <> 1 then raise exception 'FAIL: lesson visibility wrong'; end if;
  raise notice 'PASS: ready lessons are public, unfinished ones are hidden';
end $$;
reset role;
rollback;
