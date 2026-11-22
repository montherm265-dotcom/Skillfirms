-- 0041: the tutor's rule decides the certificate: checks, a project, or both.
begin;
create temp table k (role text, id uuid);
grant select on k to authenticated;
insert into k select 'tutor', id from public.profiles order by id limit 1;
insert into k select 'learner', id from public.profiles where id not in (select id from k) order by id limit 1;
delete from public.skillfirms_experts where profile_id = (select id from k where role = 'tutor');
insert into public.skillfirms_experts (profile_id, display_name, headline, active, ref_code, approved_at)
  values ((select id from k where role = 'tutor'), 'T41 Tutor', 'Process engineer', true, 't41ref', now()) returning id \gset e_
insert into public.skillfirms_courses (expert_id, slug, title, level, status, taught_by, price_cents, certificate_rule, project_brief, project_days)
  values (:'e_id', 't41-course', 'Reading P&IDs', 'beginner', 'published', 'expert', 2900, 'project',
          'Mark up the attached P&ID: find every control loop and list its instruments.', 7) returning id \gset c_
insert into k values ('course', :'c_id');
insert into public.skillfirms_course_modules (course_id, order_index, title, has_quiz) values (:'c_id', 0, 'Symbols', false);
insert into public.skillfirms_course_purchases (user_id, course_id, price_cents, payment_status) values ((select id from k where role = 'learner'), :'c_id', 2900, 'paid');
insert into public.skillfirms_enrollments (user_id, course_id) values ((select id from k where role = 'learner'), :'c_id');

set role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from k where role = 'learner'), true);
do $$ declare c uuid := (select id from k where role = 'course'); begin
  if (public.skillfirms_course_project(c)->>'days')::int <> 7 then raise exception 'FAIL: project not shown'; end if;
  begin perform public.skillfirms_submit_course_project(c, 'https://example.com/work'); raise exception 'FAIL: submit before start';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform public.skillfirms_start_course_project(c);
  begin perform public.skillfirms_submit_course_project(c, 'not a link'); raise exception 'FAIL: bad link';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform public.skillfirms_submit_course_project(c, 'https://example.com/work', 'Found 6 loops');
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from k where role = 'tutor'), true);
do $$ begin
  if jsonb_array_length(public.skillfirms_project_reviews()) <> 1 then raise exception 'FAIL: tutor queue'; end if;
  perform public.skillfirms_review_course_project((select (x->>'id')::uuid from jsonb_array_elements(public.skillfirms_project_reviews()) x limit 1), true, 'All six loops found and labelled right.');
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.skillfirms_credentials where user_id = (select id from k where role = 'learner') and course_id = (select id from k where role = 'course') and status = 'active_verified') then
    raise exception 'FAIL: no certificate after a passed project'; end if;
  raise notice 'PASS: project course: start, hand in, tutor passes, certificate issued';
end $$;

-- 'both': a passed project alone is not enough.
update public.skillfirms_credentials set status = 'superseded' where course_id = (select id from k where role = 'course');
update public.skillfirms_courses set certificate_rule = 'both' where id = (select id from k where role = 'course');
insert into public.skillfirms_module_quiz_questions (module_id, order_index, question, choices, correct_index)
  select id, 0, 'Q?', '["a","b"]'::jsonb, 0 from public.skillfirms_course_modules where course_id = (select id from k where role = 'course');
do $$ begin
  if public._skillfirms_maybe_certify((select id from k where role = 'learner'), (select id from k where role = 'course')) is not null then
    raise exception 'FAIL: both rule certified without checks'; end if;
  raise notice 'PASS: both rule needs the checks too';
end $$;
rollback;
