-- Regression check for 0026: reviews need a passed lesson, notes and saved lists are private. Rolled back.
begin;
create temp table t_c on commit drop as select id from public.skillfirms_courses where slug = 'cqv-bootcamp';
grant select on t_c to anon, authenticated;
-- carol (...03) enrolls; alice (...01) does not.
insert into public.skillfirms_enrollments (user_id, course_id) select '00000000-0000-0000-0000-000000000003', id from t_c;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  perform public.skillfirms_review_course((select id from t_c), 5, 'Great');
  raise exception 'FAIL: review allowed before passing a lesson';
exception when raise_exception then
  if sqlerrm not like 'pass_a_lesson_first%' then raise; end if;
  raise notice 'PASS: you must pass a lesson before rating';
end $$;
reset role;

-- carol passes lesson 1 (as the grading function would).
insert into public.skillfirms_module_progress (enrollment_id, module_id, completed_at, quiz_score)
select e.id, m.id, now(), 1 from public.skillfirms_enrollments e
join public.skillfirms_course_modules m on m.course_id = e.course_id and m.order_index = 0
where e.user_id = '00000000-0000-0000-0000-000000000003' and e.course_id = (select id from t_c);

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select public.skillfirms_review_course((select id from t_c), 4, 'Clear and practical.');
select public.skillfirms_review_course((select id from t_c), 5, 'Even better on a second read.');
do $$ begin
  if exists (select 1 from public.skillfirms_course_reviews) then raise exception 'FAIL: reviews table readable directly'; end if;
exception when insufficient_privilege then raise notice 'PASS: reviews table is not readable directly';
end $$;
insert into public.skillfirms_lesson_notes (user_id, module_id, body)
select '00000000-0000-0000-0000-000000000003', id, 'my secret note' from public.skillfirms_course_modules where course_id = (select id from t_c) and order_index = 0;
insert into public.skillfirms_saved_courses (user_id, course_id) select '00000000-0000-0000-0000-000000000003', id from t_c;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ begin
  if exists (select 1 from public.skillfirms_lesson_notes) or exists (select 1 from public.skillfirms_saved_courses) then
    raise exception 'FAIL: someone else''s notes or saved list visible'; end if;
  begin
    insert into public.skillfirms_lesson_notes (user_id, module_id, body)
    select '00000000-0000-0000-0000-000000000003', id, 'forged' from public.skillfirms_course_modules limit 1;
    raise exception 'FAIL: wrote a note as someone else';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: notes and saved lists are private';
end $$;
reset role;

set role anon;
do $$ declare r jsonb; begin
  r := public.skillfirms_course_reviews_for((select id from t_c));
  if (r->>'count')::int <> 1 or (r->>'avg')::numeric <> 5 then raise exception 'FAIL: one edited review expected, got %', r; end if;
  if (r->'reviews'->0->>'passed')::int <> 1 then raise exception 'FAIL: lessons passed not shown'; end if;
  if (r->'reviews'->0->>'name') ~ ' [A-Za-z]{2,}' then raise exception 'FAIL: full surname shown: %', r->'reviews'->0->>'name'; end if;
  if (r->>'can_review')::boolean then raise exception 'FAIL: signed-out visitor can review'; end if;
  raise notice 'PASS: public reviews: one per person, real average, first name + initial, lessons passed';
end $$;
reset role;
do $$ begin
  if (select rating_count from public.skillfirms_courses where id = (select id from t_c)) <> 1 then raise exception 'FAIL: course rating_count not updated'; end if;
  raise notice 'PASS: course rating comes from real reviews';
end $$;
rollback;
