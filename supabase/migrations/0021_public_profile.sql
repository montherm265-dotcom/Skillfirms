-- A genuinely competitive gap vs. LinkedIn-style platforms: every
-- individual Skillfirms credential already has a public verify page
-- (/verify/:code), but there was no single place to see someone's whole
-- skill portfolio -- the one thing LinkedIn's whole product is built
-- around. This adds an explicit opt-in public profile (default OFF --
-- aggregating every credential + skill in one place is more exposure
-- than any single already-public verify link, so it needs its own
-- consent, not an inherited default) and a SECURITY DEFINER read
-- function that respects it.

alter table public.skillfirms_user_settings add column public_profile_enabled boolean not null default false;

create or replace function public.get_skillfirms_public_profile(p_username citext)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_profile public.profiles;
  v_enabled boolean;
  v_credentials jsonb;
  v_top_skills jsonb;
  v_courses_completed integer;
  v_missions_completed integer;
begin
  select * into v_profile from public.profiles where username = p_username;
  if v_profile is null then return null; end if;

  -- A scalar subquery, not a plain `select ... into` over a filtered
  -- scan: a user with no skillfirms_user_settings row at all (nothing
  -- creates one by default) would otherwise leave v_enabled as NULL,
  -- not false, since `select into` never assigns its target when zero
  -- rows match. `if not v_enabled` on a NULL is false in PL/pgSQL, so
  -- the early return below would be silently skipped -- exposing the
  -- profile/credentials PUBLICLY by default, the exact opposite of the
  -- "opt-in, default OFF" design this migration's own header promises.
  -- Same scalar-subquery COALESCE pattern already correct for this
  -- exact failure mode in 0013_talfirms_sharing_consent.sql.
  v_enabled := coalesce((select public_profile_enabled from public.skillfirms_user_settings where user_id = v_profile.id), false);
  if not v_enabled then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'credential_code', c.credential_code,
      'credential_name', c.credential_name,
      'source_type', c.source_type,
      'issued_at', c.issued_at
    ) order by c.issued_at desc), '[]'::jsonb)
    into v_credentials
    from public.skillfirms_credentials c
    where c.user_id = v_profile.id and c.status = 'active_verified';

  select coalesce(jsonb_agg(jsonb_build_object(
      'skill_name', s.name,
      'proficiency', st.proficiency,
      'proficiency_source', st.proficiency_source
    ) order by st.proficiency desc), '[]'::jsonb)
    into v_top_skills
    from (select * from public.skillfirms_user_skill_state where user_id = v_profile.id order by proficiency desc limit 8) st
    join public.skillfirms_skills s on s.id = st.skill_id;

  select count(*) into v_courses_completed from public.skillfirms_enrollments where user_id = v_profile.id and status = 'completed';
  select count(distinct mission_id) into v_missions_completed from public.skillfirms_mission_submissions where user_id = v_profile.id and status in ('ai_evaluated', 'expert_reviewed');

  return jsonb_build_object(
    'display_name', v_profile.display_name,
    'headline', v_profile.headline,
    'credentials', v_credentials,
    'top_skills', v_top_skills,
    'courses_completed', v_courses_completed,
    'missions_completed', v_missions_completed
  );
end;
$function$;

revoke all on function public.get_skillfirms_public_profile(citext) from public;
grant execute on function public.get_skillfirms_public_profile(citext) to anon, authenticated;
