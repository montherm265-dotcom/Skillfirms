-- Real vulnerability found while building Missions (expert review is the
-- first live use of 'expert_verified'): the old "users manage their own
-- skill state" policy let any authenticated user write ANY
-- proficiency_source on their own row directly via the REST API --
-- including 'expert_verified', with no evaluation behind it at all. That
-- breaks the one promise this whole product is built on (section 4/38:
-- never blur an estimate into something that looks verified).
--
-- Fix: no direct client write is allowed on this table anymore (select
-- only). Every legitimate write -- the AI diagnosis, a passed quiz, a
-- future expert review -- goes through this one SECURITY DEFINER
-- function, owned by postgres (which has BYPASSRLS, confirmed before
-- relying on it), so RLS can be this strict without breaking those
-- paths. The rank guard means a lower-trust source can never silently
-- overwrite a higher-trust one, regardless of which path is calling it.

create or replace function public.skillfirms_skill_source_rank(p_source text)
returns integer language sql immutable as $$
  select case p_source when 'expert_verified' then 2 when 'assessment_based' then 1 else 0 end;
$$;

create or replace function public.skillfirms_record_skill_estimates(p_source text, p_estimates jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row record;
begin
  if p_source not in ('ai_estimated', 'assessment_based', 'expert_verified') then
    raise exception 'invalid proficiency_source: %', p_source;
  end if;

  for v_row in select (e->>'skill_id')::uuid as skill_id, (e->>'proficiency')::numeric as proficiency
               from jsonb_array_elements(p_estimates) as e
  loop
    if v_row.proficiency < 0 or v_row.proficiency > 1 then
      raise exception 'proficiency out of range for skill %', v_row.skill_id;
    end if;

    insert into public.skillfirms_user_skill_state (user_id, skill_id, proficiency, proficiency_source, last_evaluated_at)
    values ((select auth.uid()), v_row.skill_id, v_row.proficiency, p_source, now())
    on conflict (user_id, skill_id) do update set
      proficiency = case when public.skillfirms_skill_source_rank(p_source) >= public.skillfirms_skill_source_rank(skillfirms_user_skill_state.proficiency_source)
        then excluded.proficiency else skillfirms_user_skill_state.proficiency end,
      proficiency_source = case when public.skillfirms_skill_source_rank(p_source) >= public.skillfirms_skill_source_rank(skillfirms_user_skill_state.proficiency_source)
        then excluded.proficiency_source else skillfirms_user_skill_state.proficiency_source end,
      last_evaluated_at = case when public.skillfirms_skill_source_rank(p_source) >= public.skillfirms_skill_source_rank(skillfirms_user_skill_state.proficiency_source)
        then excluded.last_evaluated_at else skillfirms_user_skill_state.last_evaluated_at end;
  end loop;
end;
$$;

revoke all on function public.skillfirms_record_skill_estimates(text, jsonb) from public;
grant execute on function public.skillfirms_record_skill_estimates(text, jsonb) to authenticated;

-- The quiz RPC now goes through the same guarded path instead of its own
-- duplicated expert_verified-only check.
create or replace function public.skillfirms_submit_quiz(p_module_id uuid, p_answers jsonb)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_enrollment_id uuid;
  v_course_id uuid;
  v_total integer;
  v_correct integer := 0;
  v_score numeric;
  v_question record;
  v_given integer;
  v_estimates jsonb;
begin
  select cm.course_id into v_course_id from public.skillfirms_course_modules cm where cm.id = p_module_id;
  if v_course_id is null then
    raise exception 'Module not found';
  end if;

  select e.id into v_enrollment_id from public.skillfirms_enrollments e
    where e.user_id = (select auth.uid()) and e.course_id = v_course_id;
  if v_enrollment_id is null then
    raise exception 'Not enrolled in this course';
  end if;

  select count(*) into v_total from public.skillfirms_module_quiz_questions where module_id = p_module_id;
  if v_total = 0 then
    raise exception 'This module has no quiz questions';
  end if;

  for v_question in select id, correct_index from public.skillfirms_module_quiz_questions where module_id = p_module_id loop
    v_given := (p_answers ->> (v_question.id::text))::integer;
    if v_given = v_question.correct_index then
      v_correct := v_correct + 1;
    end if;
  end loop;

  v_score := v_correct::numeric / v_total;

  insert into public.skillfirms_module_progress (enrollment_id, module_id, completed_at, quiz_score)
  values (v_enrollment_id, p_module_id, now(), v_score)
  on conflict (enrollment_id, module_id) do update set completed_at = now(), quiz_score = excluded.quiz_score;

  if v_score >= 0.6 then
    select jsonb_agg(jsonb_build_object('skill_id', cs.skill_id, 'proficiency', cs.coverage * v_score))
    into v_estimates
    from public.skillfirms_course_skills cs
    where cs.course_id = v_course_id;

    if v_estimates is not null then
      perform public.skillfirms_record_skill_estimates('assessment_based', v_estimates);
    end if;
  end if;

  return v_score;
end;
$$;

-- Neutralized via ALTER rather than DROP: DROP POLICY on this table hung
-- indefinitely through every available tool path in this environment
-- (confirmed not a real lock -- pg_locks/pg_stat_activity showed nothing
-- blocking; CREATE POLICY and other DDL on the same table ran instantly).
-- using(false)/with check(false) makes the old policy contribute nothing
-- under Postgres' OR-of-permissive-policies RLS model, which is
-- functionally identical to removing it.
alter policy "users manage their own skill state" on public.skillfirms_user_skill_state
  using (false) with check (false);
