-- Graded checks come only from the tutor or organisation that teaches a
-- course, never from Skillfirms. The free AI-taught basics are for learning:
-- no quiz, no certificate, no proof on Talfirms. A learner marks each lesson
-- done instead. Nothing is deleted.

-- 1. Quizzes on AI-taught courses are refused.
select public._edit_fn('public.skillfirms_submit_quiz(uuid,jsonb)'::regprocedure, array[array[
  $a$  if v_course_id is null then raise exception 'Module not found'; end if;$a$,
  $b$  if v_course_id is null then raise exception 'Module not found'; end if;
  if (select taught_by from public.skillfirms_courses where id = v_course_id) = 'ai' then
    raise exception 'no_check: free basics have no graded check; mark the lesson done';
  end if;$b$]]);

update public.skillfirms_course_modules m set has_quiz = false
from public.skillfirms_courses c where c.id = m.course_id and c.taught_by = 'ai' and m.has_quiz;

-- 2. Mark a free-basics lesson done (no score, no certificate).
create or replace function public.skillfirms_finish_lesson(p_module_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_enrollment uuid;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select m.course_id into v_course from public.skillfirms_course_modules m
    join public.skillfirms_courses c on c.id = m.course_id
    where m.id = p_module_id and c.taught_by = 'ai';
  if v_course is null then raise exception 'not_free_basics: this lesson ends in your tutor''s check'; end if;
  select id into v_enrollment from public.skillfirms_enrollments where user_id = auth.uid() and course_id = v_course;
  if v_enrollment is null then raise exception 'Not enrolled in this course'; end if;
  insert into public.skillfirms_module_progress (enrollment_id, module_id, completed_at)
  values (v_enrollment, p_module_id, now())
  on conflict (enrollment_id, module_id) do update set completed_at = coalesce(public.skillfirms_module_progress.completed_at, now());
  return true;
end;
$$;
revoke all on function public.skillfirms_finish_lesson(uuid) from public, anon;
grant execute on function public.skillfirms_finish_lesson(uuid) to authenticated;

-- 3. Certificates earned on AI-written checks no longer stand.
update public.skillfirms_credentials k set status = 'revoked', revoked_at = now(),
  revoked_reason = 'Free AI-taught basics no longer award certificates: checks now come only from the tutor or organisation that teaches a course.'
from public.skillfirms_courses c where c.id = k.course_id and c.taught_by = 'ai' and k.status = 'active_verified';
