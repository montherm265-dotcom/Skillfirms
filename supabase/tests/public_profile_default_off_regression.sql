-- Regression test for get_skillfirms_public_profile (supabase/migrations/
-- 0021_public_profile.sql). This migration sat as an untracked, never-
-- applied draft for a long stretch of this session before being found
-- and fixed: its original public_profile_enabled check used
-- `select coalesce(public_profile_enabled, false) into v_enabled from
-- skillfirms_user_settings where user_id = ...` -- a plain `select
-- into` over a filtered scan, not a scalar subquery. For a user with
-- NO settings row at all (nothing creates one by default for every
-- user), zero rows match, so `select into` never assigns v_enabled and
-- it stays NULL, not false. `if not v_enabled` on NULL evaluates false
-- in PL/pgSQL, so the early return was silently skipped -- exposing
-- the profile, credentials, and skills PUBLICLY by default, the exact
-- opposite of the "opt-in, default OFF" design the migration's own
-- header comment promises. Fixed with a scalar subquery (always
-- returns exactly one row, NULL when no match, so the outer COALESCE
-- actually applies), the same pattern already correct in
-- 0013_talfirms_sharing_consent.sql.
--
-- Uses real seed profiles (migration 0005 or earlier) that genuinely
-- have no skillfirms_user_settings row at all -- confirmed live via
-- `select p.id from profiles p where not exists (select 1 from
-- skillfirms_user_settings s where s.user_id = p.id)` -- rather than
-- DELETEing an existing row to construct that state (a bare DELETE
-- statement reliably hangs this project's Supabase MCP tool, a
-- distinct instance of the tool-level hangs already documented in
-- Talfirms' migration headers, confirmed live via pg_stat_activity
-- showing zero corresponding server-side activity during the hang).
--
-- Run this by hand (Supabase SQL editor, or the Supabase MCP's
-- execute_sql) against the real project after any change to this
-- function.

begin;

-- The exact bug condition: no settings row exists for this user at all.
set role anon;
select public.get_skillfirms_public_profile('marcus_okafor') as result into temp t_no_settings_row;
reset role;

insert into public.skillfirms_user_settings (user_id, public_profile_enabled) values ('a1000000-0000-4000-8000-000000000002', true);

set role anon;
select public.get_skillfirms_public_profile('marcus_okafor') as result into temp t_opted_in;
reset role;

update public.skillfirms_user_settings set public_profile_enabled = false where user_id = 'a1000000-0000-4000-8000-000000000002';
set role anon;
select public.get_skillfirms_public_profile('marcus_okafor') as result into temp t_opted_out;
reset role;

select
  (select result from t_no_settings_row) is null as expect_true__no_settings_row_returns_null_not_exposed,
  (select result from t_opted_in) is not null as expect_true__opted_in_returns_data,
  (select result from t_opted_out) is null as expect_true__opted_out_returns_null;

rollback;
