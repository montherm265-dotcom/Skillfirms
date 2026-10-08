-- The Talfirms-sharing toggle (0013) was all-or-nothing: share
-- everything or nothing, no way to hide one specific credential while
-- keeping the rest visible. Adds real per-credential control.
--
-- Column-level grant, not just RLS: narrows `authenticated`'s existing
-- broad table-level UPDATE grant down to this one column, so a crafted
-- PATCH can never touch credential_name/status/source_type/etc -- only
-- hidden_from_talfirms, and only on the caller's own row (RLS below).
alter table public.skillfirms_credentials add column if not exists hidden_from_talfirms boolean not null default false;

revoke update on public.skillfirms_credentials from authenticated;
grant update (hidden_from_talfirms) on public.skillfirms_credentials to authenticated;

create policy "users hide or show their own credentials" on public.skillfirms_credentials for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Whichever name the public-read policy currently has (the original
-- "shared active credentials are publicly readable" if 0019 never
-- applied, or the merged "credentials read access" if it did) gets the
-- same added condition, via ALTER so no DROP is required.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'skillfirms_credentials' and policyname = 'credentials read access'
  ) then
    execute $policy$
      alter policy "credentials read access" on public.skillfirms_credentials using (
        skillfirms_is_admin()
        or (status = 'active_verified' and skillfirms_shares_credentials_with_talfirms(user_id) and not hidden_from_talfirms)
        or user_id = (select auth.uid())
      )
    $policy$;
  elsif exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'skillfirms_credentials' and policyname = 'shared active credentials are publicly readable'
  ) then
    execute $policy$
      alter policy "shared active credentials are publicly readable" on public.skillfirms_credentials using (
        status = 'active_verified' and skillfirms_shares_credentials_with_talfirms(user_id) and not hidden_from_talfirms
      )
    $policy$;
  end if;
end $$;
