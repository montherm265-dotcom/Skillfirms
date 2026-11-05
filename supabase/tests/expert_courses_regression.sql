-- Regression check for 0030: expert-taught courses, review, paid access. Rolled back.
-- bob (...02) is an approved expert; carol (...03) isn't an expert and is the learner; dave (...04) is admin.
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000004', 'dave-admin-ec@example.test') on conflict (id) do nothing;
insert into public.profiles (id, username, display_name) values ('00000000-0000-0000-0000-000000000004', 'dave_admin_ec', 'Dave Admin') on conflict (id) do nothing;
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-000000000004';
insert into public.skillfirms_experts (profile_id, display_name, headline, active, approved_at)
values ('00000000-0000-0000-0000-000000000002', 'Bob Expert', 'Validation lead', true, now());
create temp table t_k (k text primary key, v uuid) on commit drop;
grant all on t_k to authenticated;

create temp table t_course on commit drop as select jsonb_build_object(
  'title', 'Writing URS that pass review', 'description', 'From a real validation lead.', 'level', 'intermediate', 'price_cents', 4900,
  'skill_ids', (select jsonb_agg(id) from (select id from public.skillfirms_skills limit 2) s),
  'lessons', jsonb_build_array(
    jsonb_build_object('title', 'Why URS fail', 'duration_minutes', 12, 'video_url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'summary', 'Free preview lesson',
      'sections', jsonb_build_array(jsonb_build_object('heading', 'Intro', 'body', 'Short text.')), 'key_points', jsonb_build_array('Be testable'),
      'questions', jsonb_build_array(
        jsonb_build_object('question', 'Q1?', 'choices', jsonb_build_array('a', 'b', 'c'), 'answer_index', 1),
        jsonb_build_object('question', 'Q2?', 'choices', jsonb_build_array('a', 'b'), 'answer_index', 0),
        jsonb_build_object('question', 'Q3?', 'choices', jsonb_build_array('a', 'b', 'c', 'd'), 'answer_index', 3))),
    jsonb_build_object('title', 'Testable requirements', 'duration_minutes', 20, 'summary', 'Paid lesson',
      'sections', jsonb_build_array(jsonb_build_object('heading', 'Body', 'body', repeat('Paid content about acceptance criteria. ', 12))),
      'questions', jsonb_build_array(
        jsonb_build_object('question', 'Q4?', 'choices', jsonb_build_array('a', 'b'), 'answer_index', 1),
        jsonb_build_object('question', 'Q5?', 'choices', jsonb_build_array('a', 'b'), 'answer_index', 1)))
  )) c;
grant select on t_course to authenticated;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  perform public.skillfirms_studio_save(null, (select c from t_course));
  raise exception 'FAIL: non-expert built a course';
exception when raise_exception then
  if sqlerrm not like 'experts_only%' then raise; end if;
  raise notice 'PASS: only approved experts can build courses';
end $$;
do $$ begin
  insert into public.skillfirms_courses (expert_id, slug, title, level, duration_hours, status, taught_by)
  values ((select id from public.skillfirms_experts limit 1), 'sneaky', 'Sneaky', 'beginner', 1, 'published', 'expert');
  raise exception 'FAIL: course inserted directly';
exception when insufficient_privilege then raise notice 'PASS: nobody can write or publish courses directly';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into t_k select 'course', public.skillfirms_studio_save(null, (select c from t_course));
do $$ begin
  perform public.skillfirms_studio_submit((select v from t_k where k = 'course'));
  raise exception 'FAIL: submitted with a lesson that has only 2 questions';
exception when raise_exception then
  if sqlerrm not like 'needs_questions%' then raise; end if;
  raise notice 'PASS: every lesson needs at least 3 graded questions before review';
end $$;
-- fix lesson 2 (add a third question) and submit
select public.skillfirms_studio_save((select v from t_k where k = 'course'),
  jsonb_set((select c from t_course), '{lessons,1,questions}',
    ((select c from t_course)->'lessons'->1->'questions') || jsonb_build_array(jsonb_build_object('question', 'Q6?', 'choices', jsonb_build_array('a', 'b'), 'answer_index', 0))));
select public.skillfirms_studio_submit((select v from t_k where k = 'course'));
do $$ begin
  if (select status from public.skillfirms_courses where id = (select v from t_k where k = 'course')) <> 'draft' then
    raise exception 'FAIL: published without admin review'; end if;
  raise notice 'PASS: submitting doesn''t publish; it waits for the admin';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select public.skillfirms_admin_review_course((select v from t_k where k = 'course'), 'approve', null);
reset role;
do $$ begin
  if not exists (select 1 from public.skillfirms_courses where id = (select v from t_k where k = 'course') and status = 'published' and taught_by = 'expert') then
    raise exception 'FAIL: approval didn''t publish as expert-taught'; end if;
  raise notice 'PASS: admin approval publishes it as expert-taught';
end $$;

-- carol (not an admin): preview yes, paid lesson no, checks no, answers never.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ declare n int; begin
  select count(*) into n from public.skillfirms_lessons l join public.skillfirms_course_modules m on m.id = l.module_id where m.course_id = (select v from t_k where k = 'course');
  if n <> 1 then raise exception 'FAIL: % lessons visible before buying (want only the preview)', n; end if;
  raise notice 'PASS: before buying, only lesson 1 (preview) is readable';
end $$;
do $$ begin
  insert into public.skillfirms_enrollments (user_id, course_id) values ('00000000-0000-0000-0000-000000000003', (select v from t_k where k = 'course'));
  raise exception 'FAIL: enrolled in a paid course without buying';
exception when raise_exception then
  if sqlerrm not like 'buy_first%' then raise; end if;
  raise notice 'PASS: graded checks of a paid course need buying first';
end $$;
do $$ begin
  perform correct_index from public.skillfirms_module_quiz_questions limit 1;
  raise exception 'FAIL: answers readable';
exception when insufficient_privilege then raise notice 'PASS: learners can never read the right answers';
end $$;
do $$ declare r jsonb; begin
  r := public.skillfirms_buy_course_v2((select v from t_k where k = 'course'), null);
  if r->>'status' <> 'waitlist' then raise exception 'FAIL: %', r; end if;
  insert into t_k values ('purchase', (r->>'id')::uuid);
  raise notice 'PASS: with sales off, buying joins the waiting list (no charge)';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select public.skillfirms_admin_grant_course((select v from t_k where k = 'purchase'));
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ declare n int; begin
  select count(*) into n from public.skillfirms_lessons l join public.skillfirms_course_modules m on m.id = l.module_id where m.course_id = (select v from t_k where k = 'course');
  if n <> 2 then raise exception 'FAIL: % lessons after access', n; end if;
  insert into public.skillfirms_enrollments (user_id, course_id) values ('00000000-0000-0000-0000-000000000003', (select v from t_k where k = 'course'));
  raise notice 'PASS: with access, every lesson and check opens';
end $$;
reset role;
do $$ begin
  if (select instructor_share_cents from public.skillfirms_course_purchases where id = (select v from t_k where k = 'purchase')) <> 3430 then
    raise exception 'FAIL: instructor share not 70%%'; end if;
  raise notice 'PASS: the instructor keeps 70%% of a marketplace sale';
end $$;
rollback;
