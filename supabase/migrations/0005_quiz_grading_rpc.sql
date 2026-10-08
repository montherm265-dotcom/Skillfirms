-- Real grading, server-side only -- correct_index never reaches the
-- client (see the column grant in 0004), so this is the only place a
-- quiz can be scored. A pass is the one thing in Skillfirms allowed to
-- write proficiency_source = 'assessment_based' instead of
-- 'ai_estimated', and it never overwrites an 'expert_verified' value --
-- a lesser-trust source must never clobber a higher-trust one.
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
    insert into public.skillfirms_user_skill_state (user_id, skill_id, proficiency, proficiency_source, last_evaluated_at)
    select (select auth.uid()), cs.skill_id, cs.coverage * v_score, 'assessment_based', now()
    from public.skillfirms_course_skills cs
    where cs.course_id = v_course_id
    on conflict (user_id, skill_id) do update set
      proficiency = case
        when skillfirms_user_skill_state.proficiency_source = 'expert_verified' then skillfirms_user_skill_state.proficiency
        else greatest(skillfirms_user_skill_state.proficiency, excluded.proficiency)
      end,
      proficiency_source = case
        when skillfirms_user_skill_state.proficiency_source = 'expert_verified' then skillfirms_user_skill_state.proficiency_source
        else 'assessment_based'
      end,
      last_evaluated_at = case
        when skillfirms_user_skill_state.proficiency_source = 'expert_verified' then skillfirms_user_skill_state.last_evaluated_at
        else now()
      end;
  end if;

  return v_score;
end;
$$;

revoke all on function public.skillfirms_submit_quiz(uuid, jsonb) from public;
grant execute on function public.skillfirms_submit_quiz(uuid, jsonb) to authenticated;
