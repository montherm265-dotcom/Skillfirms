-- Infrastructure-quality gap, not a grant/ownership bug: skillfirms_submit_quiz
-- had no attempt limit and no cooldown. A caller could resubmit the quiz with a
-- fresh random guess as many times as they liked until one attempt happened to
-- score >= 0.6 -- at which point it mints a real 'assessment_based' skill
-- proficiency and a real credential, exactly as if they'd actually known the
-- material. Guess-until-you-pass is a direct hole in the one guarantee the
-- credential system exists to make.
--
-- Fix: track attempts per (enrollment, module). Allow 5 attempts, then require
-- a 24h cooldown before the counter resets and further attempts are allowed.
-- This is deliberately generous to legitimate retakes (real misreads, wanting
-- to improve a score) while making blind guessing impractical as a forgery
-- path -- it no longer resolves in one sitting.

alter table public.skillfirms_module_progress
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

create or replace function public.skillfirms_submit_quiz(p_module_id uuid, p_answers jsonb)
 returns numeric
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_enrollment_id uuid;
  v_course_id uuid;
  v_total integer;
  v_correct integer := 0;
  v_score numeric;
  v_question record;
  v_given integer;
  v_cs record;
  v_course_title text;
  v_assessment_version text;
  v_prior_attempts integer;
  v_prior_last_attempt timestamptz;
  v_next_attempts integer;
begin
  select cm.course_id, cm.assessment_version into v_course_id, v_assessment_version from public.skillfirms_course_modules cm where cm.id = p_module_id;
  if v_course_id is null then
    raise exception 'Module not found';
  end if;

  select e.id into v_enrollment_id from public.skillfirms_enrollments e
    where e.user_id = (select auth.uid()) and e.course_id = v_course_id;
  if v_enrollment_id is null then
    raise exception 'Not enrolled in this course';
  end if;

  select mp.attempt_count, mp.last_attempt_at into v_prior_attempts, v_prior_last_attempt
    from public.skillfirms_module_progress mp
    where mp.enrollment_id = v_enrollment_id and mp.module_id = p_module_id;

  if v_prior_attempts is not null and v_prior_attempts >= 5
     and v_prior_last_attempt is not null and v_prior_last_attempt > now() - interval '24 hours' then
    raise exception 'Too many quiz attempts -- please wait 24 hours before trying again';
  end if;

  v_next_attempts := case
    when v_prior_attempts is null or v_prior_last_attempt is null or v_prior_last_attempt <= now() - interval '24 hours'
      then 1
    else v_prior_attempts + 1
  end;

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

  insert into public.skillfirms_module_progress (enrollment_id, module_id, completed_at, quiz_score, attempt_count, last_attempt_at)
  values (v_enrollment_id, p_module_id, now(), v_score, v_next_attempts, now())
  on conflict (enrollment_id, module_id) do update set
    completed_at = now(), quiz_score = excluded.quiz_score,
    attempt_count = excluded.attempt_count, last_attempt_at = excluded.last_attempt_at;

  if v_score >= 0.6 then
    for v_cs in select skill_id, coverage from public.skillfirms_course_skills where course_id = v_course_id loop
      perform public.skillfirms_apply_skill_estimate((select auth.uid()), v_cs.skill_id, v_cs.coverage * v_score, 'assessment_based');
    end loop;

    select title into v_course_title from public.skillfirms_courses where id = v_course_id;
    perform public.skillfirms_issue_or_update_credential((select auth.uid()), v_course_title, 'assessment_based', v_course_id, null, v_assessment_version);
  end if;

  return v_score;
end;
$function$;

revoke execute on function public.skillfirms_submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.skillfirms_submit_quiz(uuid, jsonb) to authenticated;
