-- 1. Verified practitioner: a tutor's own job experience is confirmed on
--    Talfirms (a past manager, the company, an official employment record,
--    or a licence checked on the register) before their course can go live.
-- 2. Course outcomes: how many certified learners were later hired on
--    Talfirms for a job needing the course's skills. Shown only once 5+
--    learners are certified, so no one can be identified.
-- 3. Tutor trust: practitioner status + "proof that held up" (combined, 5+).

create or replace function public.skillfirms_is_practitioner(p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile is not null and (
    exists (select 1 from public.employment_verifications where profile_id = p_profile and status = 'confirmed')
    or exists (select 1 from public.employer_confirmations where user_id = p_profile and status = 'confirmed')
    or exists (select 1 from public.professional_licences where profile_id = p_profile and status = 'verified'));
$$;
grant execute on function public.skillfirms_is_practitioner(uuid) to anon, authenticated;

create or replace function public.skillfirms_tutor_trust(p_expert_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('practitioner', public.skillfirms_is_practitioner(e.profile_id), 'held_up', public.tutor_held_up(e.id))
  from public.skillfirms_experts e where e.id = p_expert_id;
$$;
grant execute on function public.skillfirms_tutor_trust(uuid) to anon, authenticated;

create or replace function public.skillfirms_course_outcomes(p_course uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with certified as (
    select distinct on (k.user_id) k.user_id, k.issued_at from public.skillfirms_credentials k
    where k.course_id = p_course and k.status = 'active_verified' order by k.user_id, k.issued_at),
  caps as (
    select s.capability_id from public.skillfirms_course_skills cs join public.skillfirms_skills s on s.id = cs.skill_id
    where cs.course_id = p_course and s.capability_id is not null),
  hired as (
    select distinct c.user_id from certified c
    join public.introductions i on i.candidate_id = c.user_id and i.hired_at is not null and i.hired_at > c.issued_at
    where exists (select 1 from public.opportunity_capabilities oc where oc.opportunity_id = i.opportunity_id and oc.capability_id in (select capability_id from caps)))
  select case when (select count(*) from certified) >= 5 then
    jsonb_build_object('certified', (select count(*) from certified), 'hired', (select count(*) from hired)) end;
$$;
grant execute on function public.skillfirms_course_outcomes(uuid) to anon, authenticated;

-- A course goes live only from a verified practitioner.
select public._edit_fn('public.skillfirms_studio_submit(uuid)'::regprocedure, array[array[
  $a$  if v_c.status = 'published' then raise exception 'already_published'; end if;$a$,
  $b$  if v_c.status = 'published' then raise exception 'already_published'; end if;
  if not public.skillfirms_is_practitioner((select profile_id from public.skillfirms_experts where id = v_c.expert_id)) then
    raise exception 'practitioner: confirm your own job experience on Talfirms first (a past manager, your company, an official employment record or a licence)';
  end if;$b$]]);
