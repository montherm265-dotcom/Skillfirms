-- Closes a known limitation from Talfirms' M14 audit of this project:
-- skillfirms_submit_quiz's own side effects (skillfirms_apply_skill_
-- estimate, an upsert to the same computed value rather than an
-- additive counter, and skillfirms_issue_or_update_credential,
-- already idempotent) were safe against a retried call, but the
-- attempt-rate-limit counter (0017) was not -- a dropped response
-- after the server already graded and recorded a submission would
-- make the client retry, burning a real attempt from the user's
-- 5-per-24h quota for a submission that had already succeeded. This
-- was previously documented as having "no clean mechanical fix
-- without a client-side submission idempotency key" and left as a
-- known, accepted limitation.
--
-- Fixed here with a SERVER-SIDE content-addressed fingerprint instead
-- of a client-generated key, which needs no frontend change at all
-- and sidesteps the hard part of a client-side key (correctly telling
-- "the same click retried" apart from "the user changed an answer and
-- resubmitted," which a naive client-held key gets wrong if not
-- carefully invalidated on every answer edit). The fingerprint is an
-- md5 of every question id in this module paired with the answer
-- given for it, in a stable (question id) order -- so it depends only
-- on the submission's actual content, not on p_answers' jsonb key
-- insertion order (which depends on the order the user answered
-- questions client-side, not a canonical order) and not on any
-- client-managed state. A genuine retry of the exact same submission
-- always produces the exact same fingerprint; changing even one
-- answer always produces a different one.
--
-- A retry whose fingerprint already has a stored score returns that
-- score immediately, before the rate-limit check even runs -- so it
-- costs the user nothing. This is the sequential-retry case (the
-- realistic one: a dropped HTTP response after the request already
-- succeeded server-side, discovered and retried by the same client
-- moments later) and matches the same select-then-insert pattern used
-- elsewhere in this audit for sequential retries; it is not a lock
-- against two genuinely simultaneous identical submissions (which
-- would need the same two-real-connections test this whole audit
-- could not construct in this environment) -- an accepted, documented
-- gap rather than a silent one, consistent with every other
-- concurrency-only case in this audit.
--
-- Code review on this migration caught a real bug in the first draft:
-- the fingerprint lookup matched ANY historical submission for this
-- module, not just an immediate retry -- so a rate-limited user (5
-- attempts already used in 24h) who happened to resubmit an old
-- answer set (the quiz form still holding a stale selection, or a
-- deliberate replay specifically to dodge the limit) would silently
-- get the old score back instead of the intended "too many attempts"
-- block, since the fingerprint short-circuit ran before the rate-limit
-- check. Fixed by scoping the match to a short recency window -- this
-- is meant to catch "the same request arriving twice moments apart,"
-- not "an answer set that happens to match something from the past."
--
-- Storage grows by one row per real quiz submission attempt (the same
-- order of magnitude skillfirms_module_progress.attempt_count already
-- tracks), not per retry -- no cleanup job exists in this codebase
-- (there is no scheduled-job infrastructure here at all), so this is
-- an accepted, bounded tradeoff rather than an oversight.
create table public.skillfirms_quiz_submission_fingerprints (
  enrollment_id uuid not null references public.skillfirms_enrollments(id) on delete cascade,
  module_id uuid not null references public.skillfirms_course_modules(id) on delete cascade,
  fingerprint text not null,
  score numeric not null,
  created_at timestamptz not null default now(),
  primary key (enrollment_id, module_id, fingerprint)
);

-- Internal bookkeeping only, touched exclusively by the SECURITY
-- DEFINER function below, which runs as the function owner and so
-- never needs the caller's own table grants. RLS enabled with no
-- policies at all (deny-by-default) -- no client, authenticated or
-- not, has any business reading or writing this table directly. No
-- explicit grant to service_role either: it already bypasses RLS via
-- its own role attribute, not via table grants, so one would be
-- redundant and would only contradict this table's "nothing touches
-- it directly" model for no actual effect.
alter table public.skillfirms_quiz_submission_fingerprints enable row level security;

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
  v_course_title text;
  v_assessment_version text;
  v_prior_attempts integer;
  v_prior_last_attempt timestamptz;
  v_next_attempts integer;
  v_fingerprint text;
  v_existing_score numeric;
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

  select md5(string_agg(q.id::text || ':' || coalesce(p_answers ->> q.id::text, ''), ',' order by q.id))
    into v_fingerprint
    from public.skillfirms_module_quiz_questions q
    where q.module_id = p_module_id;

  select score into v_existing_score
    from public.skillfirms_quiz_submission_fingerprints
    where enrollment_id = v_enrollment_id and module_id = p_module_id and fingerprint = v_fingerprint
      and created_at > now() - interval '5 minutes';
  if v_existing_score is not null then
    return v_existing_score;
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

  -- "do update", not "do nothing": a genuinely new attempt (outside
  -- the 5-minute window above) can still land on the same fingerprint
  -- as an old submission if the user resubmits identical answers long
  -- after the fact. That row's created_at has to be refreshed to now,
  -- or an immediate retry of THIS new submission would look up the
  -- old, stale timestamp and wrongly decide it was too old to count
  -- as a retry -- re-processing (and re-counting an attempt for) what
  -- should have been caught as a duplicate of the one that just ran.
  insert into public.skillfirms_quiz_submission_fingerprints (enrollment_id, module_id, fingerprint, score)
  values (v_enrollment_id, p_module_id, v_fingerprint, v_score)
  on conflict (enrollment_id, module_id, fingerprint) do update
    set score = excluded.score, created_at = excluded.created_at;

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
$$;

revoke all on function public.skillfirms_submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.skillfirms_submit_quiz(uuid, jsonb) to authenticated;
