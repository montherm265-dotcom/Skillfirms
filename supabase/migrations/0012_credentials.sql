-- Skillfirms Verified Skill credentials (brief section 11 concept, built
-- for real here): a permanent record of having passed a real assessment
-- -- a graded quiz (assessment_based) or a real human expert's review
-- (expert_verified) -- never issued from a plain ai_estimated guess.
-- The PDF/image is never the source of truth: skillfirms_verify_credential
-- is, and status can change (revoked/superseded) without touching the
-- historical record. No skill levels/scores are ever stored or exposed
-- here -- a credential is pass/fail, not a ranking.

alter table public.skillfirms_course_modules add column assessment_version text not null default '2026.1';
alter table public.skillfirms_missions add column assessment_version text not null default '2026.1';

create table public.skillfirms_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credential_code text not null unique check (credential_code ~ '^SF-[A-Z0-9]{8}$'),
  credential_name text not null check (char_length(credential_name) between 1 and 200),
  source_type text not null check (source_type in ('assessment_based', 'expert_verified')),
  course_id uuid references public.skillfirms_courses(id),
  mission_id uuid references public.skillfirms_missions(id),
  assessment_version text not null,
  status text not null default 'active_verified' check (status in ('active_verified', 'revoked', 'superseded')),
  superseded_by uuid references public.skillfirms_credentials(id),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text check (char_length(revoked_reason) <= 500),
  constraint skillfirms_credentials_source_shape check (
    (source_type = 'assessment_based' and course_id is not null and mission_id is null) or
    (source_type = 'expert_verified' and mission_id is not null and course_id is null)
  )
);
create unique index skillfirms_credentials_user_course_version_idx on public.skillfirms_credentials(user_id, course_id, assessment_version) where course_id is not null;
create unique index skillfirms_credentials_user_mission_version_idx on public.skillfirms_credentials(user_id, mission_id, assessment_version) where mission_id is not null;
create index skillfirms_credentials_user_idx on public.skillfirms_credentials(user_id);
alter table public.skillfirms_credentials enable row level security;
create policy "users see their own credentials" on public.skillfirms_credentials for select
  using (user_id = (select auth.uid()));
create policy "admins manage credentials" on public.skillfirms_credentials for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());
-- No plain insert/update policy for authenticated users at all: every
-- credential is issued by skillfirms_issue_or_update_credential below,
-- called only from inside skillfirms_submit_quiz /
-- skillfirms_expert_review_submission once they've already computed a
-- real passing score server-side.

create or replace function public.skillfirms_generate_credential_code()
returns text language sql volatile as $$
  select 'SF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

create or replace function public.skillfirms_issue_or_update_credential(
  p_user_id uuid, p_credential_name text, p_source_type text,
  p_course_id uuid, p_mission_id uuid, p_assessment_version text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_existing record;
  v_new_id uuid;
  v_code text;
  v_attempt integer := 0;
begin
  select * into v_existing from public.skillfirms_credentials
    where user_id = p_user_id
      and status = 'active_verified'
      and (course_id = p_course_id or (course_id is null and p_course_id is null))
      and (mission_id = p_mission_id or (mission_id is null and p_mission_id is null));

  if v_existing.id is not null and v_existing.assessment_version = p_assessment_version then
    return v_existing.id; -- already holds the current version, nothing to do
  end if;

  loop
    v_code := public.skillfirms_generate_credential_code();
    begin
      insert into public.skillfirms_credentials (user_id, credential_code, credential_name, source_type, course_id, mission_id, assessment_version)
      values (p_user_id, v_code, p_credential_name, p_source_type, p_course_id, p_mission_id, p_assessment_version)
      returning id into v_new_id;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 5 then raise; end if;
    end;
  end loop;

  if v_existing.id is not null then
    -- The underlying assessment changed since they last passed it -- the
    -- old credential stays in their history, just marked superseded
    -- rather than silently disappearing (brief section 6).
    update public.skillfirms_credentials set status = 'superseded', superseded_by = v_new_id where id = v_existing.id;
  end if;

  return v_new_id;
end;
$$;
revoke all on function public.skillfirms_issue_or_update_credential(uuid, text, text, uuid, uuid, text) from public;

-- Quiz scoring already happens server-side; a pass now also issues/
-- refreshes the course's credential, same trust boundary as the
-- proficiency write right above it.
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

    select title into v_course_title from public.skillfirms_courses where id = v_course_id;
    perform public.skillfirms_issue_or_update_credential((select auth.uid()), v_course_title, 'assessment_based', v_course_id, null, v_assessment_version);
  end if;

  return v_score;
end;
$$;

-- Same for a real expert's review: a pass issues/refreshes the
-- mission's credential, on behalf of the submission's owner (never the
-- expert), exactly like it already writes expert_verified proficiency.
create or replace function public.skillfirms_expert_review_submission(
  p_submission_id uuid, p_overall_score numeric, p_feedback text, p_strengths jsonb, p_improvements jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_expert_id uuid;
  v_user_id uuid;
  v_mission_id uuid;
  v_ms record;
  v_mission_title text;
  v_assessment_version text;
begin
  select id into v_expert_id from public.skillfirms_experts where profile_id = (select auth.uid());
  if v_expert_id is null then
    raise exception 'Only a real expert account can review a mission submission';
  end if;

  if p_overall_score < 0 or p_overall_score > 1 then
    raise exception 'overall_score out of range';
  end if;

  select user_id, mission_id into v_user_id, v_mission_id from public.skillfirms_mission_submissions where id = p_submission_id;
  if v_user_id is null then
    raise exception 'Submission not found';
  end if;

  insert into public.skillfirms_mission_evaluations (submission_id, evaluator_type, expert_id, overall_score, feedback, strengths, improvements)
  values (p_submission_id, 'expert', v_expert_id, p_overall_score, p_feedback, p_strengths, p_improvements);

  update public.skillfirms_mission_submissions set status = 'expert_reviewed' where id = p_submission_id;

  for v_ms in select skill_id, coverage from public.skillfirms_mission_skills where mission_id = v_mission_id loop
    perform public.skillfirms_apply_skill_estimate(v_user_id, v_ms.skill_id, v_ms.coverage * p_overall_score, 'expert_verified');
  end loop;

  if p_overall_score >= 0.6 then
    select title, assessment_version into v_mission_title, v_assessment_version from public.skillfirms_missions where id = v_mission_id;
    perform public.skillfirms_issue_or_update_credential(v_user_id, v_mission_title, 'expert_verified', null, v_mission_id, v_assessment_version);
  end if;
end;
$$;

-- The only way this table's data reaches an unauthenticated visitor --
-- a narrow, explicit lookup, never a broad RLS select policy on the
-- table itself. Never exposes anything beyond what a real verifier
-- needs: no internal ids, no other credentials, no unrelated profile data.
create or replace function public.skillfirms_verify_credential(p_credential_code text)
returns jsonb
language sql security definer set search_path = public stable as $$
  select case when c.id is null then null else jsonb_build_object(
    'credentialCode', c.credential_code,
    'credentialName', c.credential_name,
    'holderName', coalesce(p.display_name, 'Skillfirms member'),
    'sourceType', c.source_type,
    'assessmentVersion', c.assessment_version,
    'status', c.status,
    'issuedAt', c.issued_at,
    'revokedAt', c.revoked_at,
    'supersededByCode', sup.credential_code
  ) end
  from (select 1) as dummy
  left join public.skillfirms_credentials c on c.credential_code = upper(p_credential_code)
  left join public.profiles p on p.id = c.user_id
  left join public.skillfirms_credentials sup on sup.id = c.superseded_by;
$$;
revoke all on function public.skillfirms_verify_credential(text) from public;
grant execute on function public.skillfirms_verify_credential(text) to anon, authenticated;
