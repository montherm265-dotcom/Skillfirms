-- The Talfirms connection (brief sections 20-22), direction one:
-- Skillfirms -> Talfirms. A credential is already individually
-- publicly verifiable by anyone who HAS its code (that's the whole
-- point of skillfirms_verify_credential) -- but letting Talfirms show
-- a person's WHOLE credential list on their public profile, without
-- them asking for that, is a broader disclosure than handing someone
-- one code to check. That needs its own explicit opt-in, off by default.

create table public.skillfirms_user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  share_credentials_with_talfirms boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.skillfirms_user_settings enable row level security;
create policy "users manage their own settings" on public.skillfirms_user_settings for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- RLS can't safely reference another RLS-protected table in a plain
-- subquery (the subquery would be evaluated under the OUTER caller's
-- own policies, which is exactly what we need to bypass here) -- same
-- reasoning as skillfirms_is_admin(), so this is SECURITY DEFINER too.
create or replace function public.skillfirms_shares_credentials_with_talfirms(p_user_id uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select share_credentials_with_talfirms from public.skillfirms_user_settings where user_id = p_user_id), false);
$$;

-- Additive: the owner's own "see everything" policy and admin's policy
-- are untouched. This only ever WIDENS visibility for a credential that
-- is both currently active_verified AND whose holder opted in -- a
-- revoked or superseded credential, or an opted-out holder's, stays
-- invisible to anyone but the holder, even under this policy.
create policy "shared active credentials are publicly readable" on public.skillfirms_credentials for select
  using (status = 'active_verified' and public.skillfirms_shares_credentials_with_talfirms(user_id));
