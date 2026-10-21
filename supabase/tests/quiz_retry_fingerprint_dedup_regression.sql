-- Regression test for supabase/migrations/0022_quiz_retry_fingerprint_
-- dedup.sql: closes a known limitation from Talfirms' M14 audit of
-- this project -- skillfirms_submit_quiz's attempt-rate-limit counter
-- (0017) had no idempotency check, so a dropped-response retry of the
-- exact same submission would burn a real attempt from the user's
-- 5-per-24h quota for a submission that had already succeeded. Fixed
-- with a server-side content-addressed fingerprint (an md5 of every
-- question id paired with the answer given for it, in a stable
-- question-id order) -- needs no client change, and depends only on
-- the submission's actual content rather than any client-managed
-- state or the jsonb payload's key insertion order.
--
-- Run this by hand (Supabase SQL editor, or the Supabase MCP's
-- execute_sql) against the real project after any change to this
-- function.
--
-- Fixture identities: a real seeded course module with 3 real quiz
-- questions (migration 0005ish seed data) and two real seed profiles,
-- each given a fresh enrollment inside its own transaction only
-- (rolled back at the end).

-- 1. A retry of the exact same answers must not burn a second
-- attempt, and a genuinely different submission (one answer changed)
-- must still count as a real new attempt -- the fingerprint isn't
-- overzealous.
begin;

insert into public.skillfirms_enrollments (id, user_id, course_id) values
  ('fa200000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'aa54c88a-75ce-4b2b-81e8-3f06163d7b7e');

set role authenticated;
set request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000001';

select public.skillfirms_submit_quiz('0fe73f99-57f0-4a59-b5d6-8038bf955ac7',
  '{"343808ab-fe25-4ce1-bef1-293ed9ef2b9a":0,"6b27c39d-04a5-4ef1-92b0-07b3fda73006":0,"8e0cd5b4-ad64-4b48-989c-713bad91b70d":1}'::jsonb) as score1;

-- Retry of the EXACT same answers -- the bug this migration fixed.
select public.skillfirms_submit_quiz('0fe73f99-57f0-4a59-b5d6-8038bf955ac7',
  '{"343808ab-fe25-4ce1-bef1-293ed9ef2b9a":0,"6b27c39d-04a5-4ef1-92b0-07b3fda73006":0,"8e0cd5b4-ad64-4b48-989c-713bad91b70d":1}'::jsonb) as score2;

-- A GENUINELY different submission (one answer changed) must still
-- count as a real new attempt.
select public.skillfirms_submit_quiz('0fe73f99-57f0-4a59-b5d6-8038bf955ac7',
  '{"343808ab-fe25-4ce1-bef1-293ed9ef2b9a":1,"6b27c39d-04a5-4ef1-92b0-07b3fda73006":0,"8e0cd5b4-ad64-4b48-989c-713bad91b70d":1}'::jsonb) as score3;

reset role;

select
  (select attempt_count from public.skillfirms_module_progress where enrollment_id = 'fa200000-0000-4000-8000-000000000001' and module_id = '0fe73f99-57f0-4a59-b5d6-8038bf955ac7') as expect_2__attempt_count_counts_real_attempts_only,
  (select count(*) from public.skillfirms_quiz_submission_fingerprints where enrollment_id = 'fa200000-0000-4000-8000-000000000001' and module_id = '0fe73f99-57f0-4a59-b5d6-8038bf955ac7') as expect_2__distinct_fingerprints;

rollback;

-- 2. The retry must return the exact same score as the original call
-- (proving it short-circuited rather than silently recomputing and
-- happening to match).
begin;

insert into public.skillfirms_enrollments (id, user_id, course_id) values
  ('fa200000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'aa54c88a-75ce-4b2b-81e8-3f06163d7b7e');

set role authenticated;
set request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000002';

select public.skillfirms_submit_quiz('0fe73f99-57f0-4a59-b5d6-8038bf955ac7',
  '{"343808ab-fe25-4ce1-bef1-293ed9ef2b9a":0,"6b27c39d-04a5-4ef1-92b0-07b3fda73006":0,"8e0cd5b4-ad64-4b48-989c-713bad91b70d":1}'::jsonb) as n into temp t_first;

select public.skillfirms_submit_quiz('0fe73f99-57f0-4a59-b5d6-8038bf955ac7',
  '{"343808ab-fe25-4ce1-bef1-293ed9ef2b9a":0,"6b27c39d-04a5-4ef1-92b0-07b3fda73006":0,"8e0cd5b4-ad64-4b48-989c-713bad91b70d":1}'::jsonb) as n into temp t_retry;

reset role;

select
  (select n from t_first) = (select n from t_retry) as expect_true__retry_returns_identical_score;

rollback;

-- 3. A real bug caught by code review on this migration's first
-- draft: the fingerprint lookup matched ANY historical submission,
-- not just an immediate retry, so a rate-limited user (5 attempts
-- already used in 24h) who happened to resubmit an old answer set
-- would silently get the old score back instead of the intended
-- "too many attempts" block. Fixed by scoping the match to a 5-minute
-- recency window. This fixture backdates both the rate-limit state
-- and the matching fingerprint to an hour ago, well outside that
-- window, so the resubmission must correctly hit the rate limit.
begin;

insert into public.skillfirms_enrollments (id, user_id, course_id) values
  ('fa200000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 'aa54c88a-75ce-4b2b-81e8-3f06163d7b7e');

insert into public.skillfirms_module_progress (enrollment_id, module_id, attempt_count, last_attempt_at, completed_at) values
  ('fa200000-0000-4000-8000-000000000003', '0fe73f99-57f0-4a59-b5d6-8038bf955ac7', 5, now() - interval '1 hour', now() - interval '1 hour');
insert into public.skillfirms_quiz_submission_fingerprints (enrollment_id, module_id, fingerprint, score, created_at) values
  ('fa200000-0000-4000-8000-000000000003', '0fe73f99-57f0-4a59-b5d6-8038bf955ac7',
   md5('343808ab-fe25-4ce1-bef1-293ed9ef2b9a:0,6b27c39d-04a5-4ef1-92b0-07b3fda73006:0,8e0cd5b4-ad64-4b48-989c-713bad91b70d:1'),
   1.0, now() - interval '1 hour');

set role authenticated;
set request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000003';

do $$
begin
  begin
    perform public.skillfirms_submit_quiz('0fe73f99-57f0-4a59-b5d6-8038bf955ac7',
      '{"343808ab-fe25-4ce1-bef1-293ed9ef2b9a":0,"6b27c39d-04a5-4ef1-92b0-07b3fda73006":0,"8e0cd5b4-ad64-4b48-989c-713bad91b70d":1}'::jsonb);
    raise exception 'REGRESSION: rate limit was bypassed by an old matching fingerprint';
  exception when others then
    if sqlerrm not like 'Too many quiz attempts%' then raise; end if;
  end;
end $$;

reset role;
select 'rate limit correctly enforced' as expect_this_row__not_a_bypassed_score;
rollback;
