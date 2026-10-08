-- Real-world Missions (sections 12-15): COURSE -> ASSESSMENT -> MISSION
-- -> EVALUATION -> VERIFIED PROOF. AI evaluation of a submission lands
-- at the same 'ai_estimated' trust tier as the career diagnosis (it's
-- still an LLM's read of free text, not a deterministic grade) -- the
-- only way a mission produces 'expert_verified' proof is a real human
-- expert reviewing it through skillfirms_expert_review_submission below,
-- which checks the caller is an actual expert account before writing
-- anything on someone else's behalf.

create table public.skillfirms_missions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (char_length(title) between 1 and 200),
  brief text not null check (char_length(brief) between 1 and 8000),
  deliverable_instructions text not null check (char_length(deliverable_instructions) between 1 and 2000),
  role_id uuid references public.skillfirms_career_roles(id),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  estimated_hours numeric check (estimated_hours > 0 and estimated_hours <= 100),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now()
);
alter table public.skillfirms_missions enable row level security;
create policy "published missions are publicly readable" on public.skillfirms_missions for select using (status = 'published');
create policy "admins manage missions" on public.skillfirms_missions for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

create table public.skillfirms_mission_skills (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.skillfirms_missions(id) on delete cascade,
  skill_id uuid not null references public.skillfirms_skills(id) on delete cascade,
  coverage numeric not null check (coverage > 0 and coverage <= 1),
  constraint skillfirms_mission_skills_unique unique (mission_id, skill_id)
);
alter table public.skillfirms_mission_skills enable row level security;
create policy "mission skills are publicly readable" on public.skillfirms_mission_skills for select using (true);
create policy "admins manage mission skills" on public.skillfirms_mission_skills for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

create table public.skillfirms_mission_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.skillfirms_missions(id) on delete cascade,
  submission_text text not null check (char_length(submission_text) between 1 and 20000),
  status text not null default 'submitted' check (status in ('submitted', 'ai_evaluated', 'expert_requested', 'expert_reviewed')),
  submitted_at timestamptz not null default now()
);
create index skillfirms_mission_submissions_user_idx on public.skillfirms_mission_submissions(user_id);
alter table public.skillfirms_mission_submissions enable row level security;
create policy "users manage their own submissions" on public.skillfirms_mission_submissions for all
  using (user_id = (select auth.uid()))
  -- A plain client update can only move between the user-controlled
  -- states. 'expert_reviewed' is set exclusively by the review RPC
  -- below, which runs as a SECURITY DEFINER function and bypasses RLS.
  with check (user_id = (select auth.uid()) and status in ('submitted', 'ai_evaluated', 'expert_requested'));
create policy "experts can see submissions pending review" on public.skillfirms_mission_submissions for select
  using (exists (select 1 from public.skillfirms_experts where profile_id = (select auth.uid())));

create table public.skillfirms_mission_evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.skillfirms_mission_submissions(id) on delete cascade,
  evaluator_type text not null check (evaluator_type in ('ai', 'expert')),
  expert_id uuid references public.skillfirms_experts(id),
  overall_score numeric not null check (overall_score >= 0 and overall_score <= 1),
  feedback text check (char_length(feedback) <= 4000),
  strengths jsonb,
  improvements jsonb,
  model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  constraint skillfirms_mission_evaluations_expert_consistency check (
    (evaluator_type = 'expert' and expert_id is not null) or (evaluator_type = 'ai' and expert_id is null)
  )
);
create index skillfirms_mission_evaluations_submission_idx on public.skillfirms_mission_evaluations(submission_id);
alter table public.skillfirms_mission_evaluations enable row level security;
create policy "users see evaluations on their own submissions" on public.skillfirms_mission_evaluations for select
  using (submission_id in (select id from public.skillfirms_mission_submissions where user_id = (select auth.uid())));
create policy "experts see evaluations too" on public.skillfirms_mission_evaluations for select
  using (exists (select 1 from public.skillfirms_experts where profile_id = (select auth.uid())));
-- Only an AI evaluation can be inserted directly by its own submission's
-- owner -- it's the same "client relays a result it just got from the
-- AI" pattern already used by the diagnosis flow, same ai_estimated
-- trust tier. An expert evaluation is never client-insertable: it only
-- ever comes from skillfirms_expert_review_submission.
create policy "users record their own ai evaluation" on public.skillfirms_mission_evaluations for insert
  with check (
    evaluator_type = 'ai'
    and submission_id in (select id from public.skillfirms_mission_submissions where user_id = (select auth.uid()))
  );

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
end;
$$;
revoke all on function public.skillfirms_expert_review_submission(uuid, numeric, text, jsonb, jsonb) from public;
grant execute on function public.skillfirms_expert_review_submission(uuid, numeric, text, jsonb, jsonb) to authenticated;
