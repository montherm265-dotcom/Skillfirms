-- Regression test for skillfirms_issue_or_update_credential
-- (supabase/migrations/0012_credentials.sql, 0015/0017), part of M14's
-- broader RPC-coverage audit (Talfirms' calcnumero repo) for
-- duplicate-event/retry safety -- this is the one RPC in this repo
-- that grants a real trust artifact (a verifiable credential), so a
-- retried call (e.g. an Edge Function re-invoking this after a dropped
-- response once a quiz/assessment completes) issuing a SECOND active
-- credential for the same already-certified assessment would be a real
-- integrity problem, not just an audit-log nuisance.
--
-- Confirmed sound, not a bug: the function already short-circuits and
-- returns the SAME credential id when called again with an unchanged
-- assessment_version, and the "one active credential per (user, course
-- or mission, assessment_version)" invariant is additionally backed by
-- a real unique index (skillfirms_credentials_user_course_version_idx /
-- ..._user_mission_version_idx), not just the function's own read-then-
-- write logic -- so even a genuinely concurrent double-call (not just a
-- sequential retry) can't produce two active credentials for the same
-- version; the loser would unique-violate on insert rather than
-- silently succeed. This test exercises the sequential case (the
-- function's own idempotent short-circuit), since a true concurrency
-- test would need two real simultaneous connections this harness can't
-- construct.
--
-- Run this by hand (Supabase SQL editor, or the Supabase MCP's
-- execute_sql) against the real project after any change to this
-- function. Only postgres/service_role can call it (confirmed live via
-- information_schema.role_routine_grants), so no role-switching is
-- needed here, unlike the authenticated-role tests in Talfirms'
-- calcnumero repo.
--
-- Fixture identities: a real seed profile (shared across Talfirms/
-- Skillfirms via public.profiles) and a real, pre-existing course --
-- read-only reference data this test never modifies, safe to reuse
-- since everything this test itself writes is rolled back at the end.

begin;

select public.skillfirms_issue_or_update_credential(
  'a1000000-0000-4000-8000-000000000001', 'Regtest Credential', 'assessment_based',
  '7d4f4362-98f4-4b52-8031-3867e899be37', null, 'v1'
) as id into temp t_first;

-- Exact repeat call, same assessment_version -- the duplicate-event
-- case this test exists for: must return the SAME id, never issue a
-- second active credential.
select public.skillfirms_issue_or_update_credential(
  'a1000000-0000-4000-8000-000000000001', 'Regtest Credential', 'assessment_based',
  '7d4f4362-98f4-4b52-8031-3867e899be37', null, 'v1'
) as id into temp t_repeat;

select count(*) as n into temp t_count_after_repeat from public.skillfirms_credentials
  where user_id = 'a1000000-0000-4000-8000-000000000001' and course_id = '7d4f4362-98f4-4b52-8031-3867e899be37';

-- A genuinely new assessment_version (a real re-assessment, not a
-- retry) -- must issue a NEW credential and supersede the old one,
-- never leave two simultaneously active_verified rows.
select public.skillfirms_issue_or_update_credential(
  'a1000000-0000-4000-8000-000000000001', 'Regtest Credential', 'assessment_based',
  '7d4f4362-98f4-4b52-8031-3867e899be37', null, 'v2'
) as id into temp t_new_version;

select
  (select id from t_first) = (select id from t_repeat) as expect_true__repeat_call_returns_same_id,
  (select n from t_count_after_repeat) as expect_1__no_duplicate_row_after_repeat_call,
  (select id from t_first) <> (select id from t_new_version) as expect_true__new_version_issues_a_different_id,
  (select status from public.skillfirms_credentials where id = (select id from t_first)) as expect_superseded__old_credential_status,
  (select superseded_by from public.skillfirms_credentials where id = (select id from t_first)) = (select id from t_new_version) as expect_true__superseded_by_points_to_new_credential,
  (select status from public.skillfirms_credentials where id = (select id from t_new_version)) as expect_active_verified__new_credential_status;

rollback;
