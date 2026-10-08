-- Second real gap in the trust model, found while designing Missions:
-- skillfirms_record_skill_estimates only guarded against a lower-trust
-- source downgrading a higher one -- it never checked whether the
-- CALLER was allowed to claim a given source at all. A plain
-- authenticated user could call it directly with p_source =
-- 'assessment_based' and any proficiency, with no quiz or mission ever
-- taken. Confirmed exploitable before this migration.
--
-- Fix: split the guarded upsert into an internal helper with no grants
-- at all (callable only by other SECURITY DEFINER functions owned by
-- postgres, which always have implicit EXECUTE on functions they own
-- regardless of grants -- confirmed postgres has BYPASSRLS/owns these).
-- The only function now exposed to the 'authenticated' role in this
-- area only accepts 'ai_estimated', which is the one source a person
-- can honestly self-report (an AI guess from their own words) --
-- 'assessment_based' now only ever gets written by server logic that
-- computed the score itself (the quiz RPC), and 'expert_verified' will
-- only ever be written by a real expert's own RPC (built with Missions).

create or replace function public.skillfirms_apply_skill_estimate(p_user_id uuid, p_skill_id uuid, p_proficiency numeric, p_source text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_source not in ('ai_estimated', 'assessment_based', 'expert_verified') then
    raise exception 'invalid proficiency_source: %', p_source;
  end if;
  if p_proficiency < 0 or p_proficiency > 1 then
    raise exception 'proficiency out of range for skill %', p_skill_id;
  end if;

  insert into public.skillfirms_user_skill_state (user_id, skill_id, proficiency, proficiency_source, last_evaluated_at)
  values (p_user_id, p_skill_id, p_proficiency, p_source, now())
  on conflict (user_id, skill_id) do update set
    proficiency = case when public.skillfirms_skill_source_rank(p_source) >= public.skillfirms_skill_source_rank(skillfirms_user_skill_state.proficiency_source)
      then excluded.proficiency else skillfirms_user_skill_state.proficiency end,
    proficiency_source = case when public.skillfirms_skill_source_rank(p_source) >= public.skillfirms_skill_source_rank(skillfirms_user_skill_state.proficiency_source)
      then excluded.proficiency_source else skillfirms_user_skill_state.proficiency_source end,
    last_evaluated_at = case when public.skillfirms_skill_source_rank(p_source) >= public.skillfirms_skill_source_rank(skillfirms_user_skill_state.proficiency_source)
      then excluded.last_evaluated_at else skillfirms_user_skill_state.last_evaluated_at end;
end;
$$;
revoke all on function public.skillfirms_apply_skill_estimate(uuid, uuid, numeric, text) from public;

-- Self-service entry point: ai_estimated only.
create or replace function public.skillfirms_record_skill_estimates(p_source text, p_estimates jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row record;
begin
  if p_source <> 'ai_estimated' then
    raise exception 'skillfirms_record_skill_estimates only accepts ai_estimated -- % must be written by a server-graded path', p_source;
  end if;

  for v_row in select (e->>'skill_id')::uuid as skill_id, (e->>'proficiency')::numeric as proficiency
               from jsonb_array_elements(p_estimates) as e
  loop
    perform public.skillfirms_apply_skill_estimate((select auth.uid()), v_row.skill_id, v_row.proficiency, 'ai_estimated');
  end loop;
end;
$$;

-- Quiz scoring already happens server-side in this function -- it now
-- writes through the internal helper directly instead of the public,
-- client-callable RPC.
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
  v_cs record;
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
    for v_cs in select skill_id, coverage from public.skillfirms_course_skills where course_id = v_course_id loop
      perform public.skillfirms_apply_skill_estimate((select auth.uid()), v_cs.skill_id, v_cs.coverage * v_score, 'assessment_based');
    end loop;
  end if;

  return v_score;
end;
$$;
