-- A tutor's Talfirms record, shown where it matters:
--   * to Skillfirms admins deciding a tutor application (yes or no), and
--   * to learners on the tutor's public page.
-- Jobs come from their Talfirms profile, each marked with how (if at all)
-- it was confirmed: by the company, by an official employment record, or by
-- a past manager. Plus checked licences, Trust Score level, and whether the
-- proof they signed held up. Only what their public Talfirms profile shows.
create or replace function public._tutor_record(p_profile uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username', p.username,
    'practitioner', public.skillfirms_is_practitioner(p.id),
    'trust', public.trust_scores(array[p.id]) -> p.id::text,
    'jobs', (select coalesce(jsonb_agg(j order by (j->>'current')::boolean desc, j->>'start' desc nulls last), '[]') from (
      select jsonb_build_object('title', w.title, 'company', w.company_name, 'start', w.start_date, 'end', w.end_date, 'current', coalesce(w.is_current, false),
        'confirmed_by', case
          when exists (select 1 from public.employment_verifications v where v.experience_id = w.id and v.status = 'confirmed' and v.kind = 'company') then 'company'
          when exists (select 1 from public.employment_verifications v where v.experience_id = w.id and v.status = 'confirmed') then 'official record'
          when exists (select 1 from public.employer_confirmations c where c.experience_id = w.id and c.status = 'confirmed') then 'manager'
          end) j
      from public.work_experiences w where w.profile_id = p.id
      order by w.start_date desc nulls last limit 8) t),
    'licences', (select coalesce(jsonb_agg(jsonb_build_object('profession', l.profession, 'country', l.country)), '[]')
                 from public.professional_licences l where l.profile_id = p.id and l.status = 'verified')
  )
  from public.profiles p where p.id = p_profile and p.deleted_at is null;
$$;
revoke all on function public._tutor_record(uuid) from public, anon, authenticated;

-- Public: only for an approved, active tutor.
create or replace function public.skillfirms_instructor_record(p_expert_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public._tutor_record(e.profile_id) || jsonb_build_object('held_up', public.tutor_held_up(e.id))
  from public.skillfirms_experts e where e.id = p_expert_id and coalesce(e.active, true) and e.profile_id is not null;
$$;
grant execute on function public.skillfirms_instructor_record(uuid) to anon, authenticated;

-- Admins see the same record on every application.
create or replace function public.skillfirms_admin_expert_applications()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.skillfirms_is_admin() then '[]'::jsonb else coalesce(jsonb_agg(x order by (x->>'status' = 'pending') desc, x->>'created_at' desc), '[]'::jsonb) end
  from (
    select jsonb_build_object(
      'id', a.id, 'status', a.status, 'headline', a.headline, 'experience', a.experience, 'years', a.years, 'links', a.links,
      'created_at', a.created_at, 'admin_note', a.admin_note,
      'name', p.display_name, 'username', p.username,
      'skills', (select coalesce(jsonb_agg(s.name order by s.name), '[]') from public.skillfirms_skills s where s.id = any(a.skill_ids)),
      'record', case when a.status = 'pending' then public._tutor_record(p.id) end
    ) x
    from public.skillfirms_expert_applications a join public.profiles p on p.id = a.profile_id
    order by a.created_at desc limit 200
  ) t;
$$;
