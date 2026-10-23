-- Full audit pass on Skillfirms (quiz-retry anti-gaming, Talfirms-consent
-- credential visibility, expert-review access) came back clean -- this
-- is the one real finding, a performance WARN from the advisor:
-- skillfirms_credentials had "admins manage credentials" (FOR ALL) still
-- active alongside three later dedicated per-command admin policies
-- ("admins delete/insert credentials", "credentials update access"),
-- so every query on this table paid for evaluating both. The FOR ALL
-- policy is the ONLY thing granting admins SELECT today (no dedicated
-- admin-select policy exists), so it can't simply be neutralized --
-- that would silently remove admin read access. Split SELECT out first,
-- with the exact same condition, then neutralize the FOR ALL policy via
-- "ALTER POLICY ... TO service_role" (the established pattern here --
-- DROP POLICY hangs this project's tooling; service_role already
-- bypasses RLS via BYPASSRLS, so scoping to it is a true no-op for
-- every real caller, identical in kind to Talfirms migration 0142).

create policy "admins select credentials" on public.skillfirms_credentials for select
  using (skillfirms_is_admin());

alter policy "admins manage credentials" on public.skillfirms_credentials to service_role;
