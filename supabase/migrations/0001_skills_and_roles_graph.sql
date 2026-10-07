-- Skillfirms' own tables, in Talfirms' public schema (prefixed
-- skillfirms_) rather than a separate Postgres schema -- Supabase's
-- PostgREST only exposes schemas explicitly added in project API
-- settings, which isn't something a migration can change, so a new
-- schema would be unreachable from the Skillfirms frontend without a
-- manual dashboard step. The prefix keeps everything self-contained and
-- verifiable right now. These tables never get written to by Talfirms;
-- Skillfirms only ever READS public.profiles for shared identity.
create or replace function public.skillfirms_is_admin()
returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from public.profiles where id = (select auth.uid())), false);
$$;

create table public.skillfirms_skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  category text not null check (char_length(category) between 1 and 60),
  created_at timestamptz not null default now()
);
create index skillfirms_skills_category_idx on public.skillfirms_skills(category);
alter table public.skillfirms_skills enable row level security;
create policy "skills are publicly readable" on public.skillfirms_skills for select using (true);
create policy "admins manage skills" on public.skillfirms_skills for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

create table public.skillfirms_skill_relationships (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skillfirms_skills(id) on delete cascade,
  related_skill_id uuid not null references public.skillfirms_skills(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('prerequisite', 'related', 'advanced_version')),
  constraint skillfirms_skill_relationships_not_self check (skill_id <> related_skill_id),
  constraint skillfirms_skill_relationships_unique unique (skill_id, related_skill_id, relationship_type)
);
create index skillfirms_skill_relationships_skill_idx on public.skillfirms_skill_relationships(skill_id);
alter table public.skillfirms_skill_relationships enable row level security;
create policy "skill relationships are publicly readable" on public.skillfirms_skill_relationships for select using (true);
create policy "admins manage skill relationships" on public.skillfirms_skill_relationships for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

create table public.skillfirms_career_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_]+$'),
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 2000),
  industry text check (char_length(industry) <= 80),
  created_at timestamptz not null default now()
);
alter table public.skillfirms_career_roles enable row level security;
create policy "career roles are publicly readable" on public.skillfirms_career_roles for select using (true);
create policy "admins manage career roles" on public.skillfirms_career_roles for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

-- The weight behind every gap percentage and readiness score -- never a
-- number the AI invents at diagnosis time. How much a role actually
-- needs a skill is reference data, set once, inspectable by anyone.
create table public.skillfirms_role_skills (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.skillfirms_career_roles(id) on delete cascade,
  skill_id uuid not null references public.skillfirms_skills(id) on delete cascade,
  importance text not null check (importance in ('required', 'preferred')),
  weight numeric not null check (weight > 0 and weight <= 1),
  constraint skillfirms_role_skills_unique unique (role_id, skill_id)
);
create index skillfirms_role_skills_role_idx on public.skillfirms_role_skills(role_id);
alter table public.skillfirms_role_skills enable row level security;
create policy "role skills are publicly readable" on public.skillfirms_role_skills for select using (true);
create policy "admins manage role skills" on public.skillfirms_role_skills for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

-- The career ladder (section 6): Mechanical Engineer -> Project Engineer
-- -> CQV Engineer -> ... -- lets "what should I learn to move from my
-- current role to this one" be a real graph traversal, not a guess.
create table public.skillfirms_role_progressions (
  id uuid primary key default gen_random_uuid(),
  from_role_id uuid not null references public.skillfirms_career_roles(id) on delete cascade,
  to_role_id uuid not null references public.skillfirms_career_roles(id) on delete cascade,
  constraint skillfirms_role_progressions_not_self check (from_role_id <> to_role_id),
  constraint skillfirms_role_progressions_unique unique (from_role_id, to_role_id)
);
alter table public.skillfirms_role_progressions enable row level security;
create policy "role progressions are publicly readable" on public.skillfirms_role_progressions for select using (true);
create policy "admins manage role progressions" on public.skillfirms_role_progressions for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

-- The real backing data for the Skill Passport (section 17). proficiency
-- is always paired with its source so the UI can never blur an AI guess
-- into something that looks like a verified result (section 4/38).
create table public.skillfirms_user_skill_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skillfirms_skills(id) on delete cascade,
  proficiency numeric not null check (proficiency >= 0 and proficiency <= 1),
  proficiency_source text not null check (proficiency_source in ('ai_estimated', 'assessment_based', 'expert_verified')),
  last_evaluated_at timestamptz not null default now(),
  constraint skillfirms_user_skill_state_unique unique (user_id, skill_id)
);
create index skillfirms_user_skill_state_user_idx on public.skillfirms_user_skill_state(user_id);
alter table public.skillfirms_user_skill_state enable row level security;
create policy "users see their own skill state" on public.skillfirms_user_skill_state for select
  using (user_id = (select auth.uid()));
create policy "users manage their own skill state" on public.skillfirms_user_skill_state for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.skillfirms_user_career_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  raw_goal_text text not null check (char_length(raw_goal_text) between 1 and 2000),
  target_role_id uuid references public.skillfirms_career_roles(id),
  target_timeline_months integer check (target_timeline_months > 0 and target_timeline_months <= 120),
  status text not null default 'active' check (status in ('active', 'achieved', 'abandoned')),
  created_at timestamptz not null default now()
);
create index skillfirms_user_career_goals_user_idx on public.skillfirms_user_career_goals(user_id, status);
alter table public.skillfirms_user_career_goals enable row level security;
create policy "users manage their own career goals" on public.skillfirms_user_career_goals for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- One row per AI diagnosis run -- this is what makes "why am I 87%"
-- (section 18) answerable after the fact instead of a number nobody can
-- explain once the moment has passed.
create table public.skillfirms_career_diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null references public.skillfirms_user_career_goals(id) on delete cascade,
  target_role_id uuid not null references public.skillfirms_career_roles(id),
  model text not null,
  prompt_version text not null,
  gaps jsonb not null,
  created_at timestamptz not null default now()
);
create index skillfirms_career_diagnoses_user_idx on public.skillfirms_career_diagnoses(user_id, created_at desc);
alter table public.skillfirms_career_diagnoses enable row level security;
create policy "users see their own diagnoses" on public.skillfirms_career_diagnoses for select
  using (user_id = (select auth.uid()));
