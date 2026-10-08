-- Sections 7-9/24-26: the intelligent course marketplace. Courses never
-- get browsed raw -- skillfirms_course_skills.coverage is what lets the
-- path assembler (lib/path.js) pick the right course for a specific
-- gap, and the quiz tables below give "assessment-based proficiency"
-- (section 4/38) a real, graded backing instead of a self-reported tick.

create table public.skillfirms_experts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  headline text not null check (char_length(headline) between 1 and 200),
  bio text check (char_length(bio) <= 4000),
  credentials text check (char_length(credentials) <= 2000),
  rating_avg numeric check (rating_avg is null or (rating_avg >= 0 and rating_avg <= 5)),
  rating_count integer not null default 0 check (rating_count >= 0),
  created_at timestamptz not null default now()
);
alter table public.skillfirms_experts enable row level security;
create policy "experts are publicly readable" on public.skillfirms_experts for select using (true);
create policy "experts manage their own profile" on public.skillfirms_experts for all
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "admins manage experts" on public.skillfirms_experts for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

create table public.skillfirms_courses (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.skillfirms_experts(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 4000),
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  duration_hours numeric check (duration_hours > 0 and duration_hours <= 500),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  rating_avg numeric check (rating_avg is null or (rating_avg >= 0 and rating_avg <= 5)),
  rating_count integer not null default 0 check (rating_count >= 0),
  enrollment_count integer not null default 0 check (enrollment_count >= 0),
  created_at timestamptz not null default now()
);
create index skillfirms_courses_expert_idx on public.skillfirms_courses(expert_id);
alter table public.skillfirms_courses enable row level security;
create policy "published courses are publicly readable" on public.skillfirms_courses for select
  using (status = 'published' or expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid())));
create policy "experts manage their own courses" on public.skillfirms_courses for insert
  with check (expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid())));
create policy "experts update their own courses" on public.skillfirms_courses for update
  using (expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid())))
  with check (expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid())));
create policy "experts delete their own courses" on public.skillfirms_courses for delete
  using (expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid())));
create policy "admins manage courses" on public.skillfirms_courses for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

-- coverage = how much of that skill's mastery this course actually
-- builds (0-1). This is what makes path assembly "intelligent" rather
-- than "browse everything": the algorithm can rank courses against a
-- specific gap instead of just matching a category tag.
create table public.skillfirms_course_skills (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  skill_id uuid not null references public.skillfirms_skills(id) on delete cascade,
  coverage numeric not null check (coverage > 0 and coverage <= 1),
  constraint skillfirms_course_skills_unique unique (course_id, skill_id)
);
create index skillfirms_course_skills_skill_idx on public.skillfirms_course_skills(skill_id);
alter table public.skillfirms_course_skills enable row level security;
create policy "course skills are publicly readable" on public.skillfirms_course_skills for select using (true);
create policy "experts manage their own course skills" on public.skillfirms_course_skills for all
  using (course_id in (select id from public.skillfirms_courses where expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid()))))
  with check (course_id in (select id from public.skillfirms_courses where expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid()))));
create policy "admins manage course skills" on public.skillfirms_course_skills for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

create table public.skillfirms_course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  order_index integer not null check (order_index >= 0),
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  duration_minutes integer check (duration_minutes > 0 and duration_minutes <= 600),
  has_quiz boolean not null default false,
  constraint skillfirms_course_modules_unique unique (course_id, order_index)
);
alter table public.skillfirms_course_modules enable row level security;
create policy "modules of visible courses are readable" on public.skillfirms_course_modules for select
  using (course_id in (select id from public.skillfirms_courses));
create policy "experts manage their own modules" on public.skillfirms_course_modules for all
  using (course_id in (select id from public.skillfirms_courses where expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid()))))
  with check (course_id in (select id from public.skillfirms_courses where expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid()))));
create policy "admins manage modules" on public.skillfirms_course_modules for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

-- correct_index must never reach the client (that's the whole point of
-- an assessment). RLS alone can't hide a column, so after this table is
-- created we revoke the default grant and re-grant only the safe
-- columns -- PostgREST respects column-level privileges.
create table public.skillfirms_module_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.skillfirms_course_modules(id) on delete cascade,
  order_index integer not null check (order_index >= 0),
  question text not null check (char_length(question) between 1 and 500),
  choices jsonb not null,
  correct_index integer not null check (correct_index >= 0 and correct_index <= 5),
  constraint skillfirms_module_quiz_questions_unique unique (module_id, order_index)
);
alter table public.skillfirms_module_quiz_questions enable row level security;
create policy "quiz questions are publicly readable" on public.skillfirms_module_quiz_questions for select using (true);
create policy "experts manage their own quiz questions" on public.skillfirms_module_quiz_questions for all
  using (module_id in (select id from public.skillfirms_course_modules where course_id in (select id from public.skillfirms_courses where expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid())))))
  with check (module_id in (select id from public.skillfirms_course_modules where course_id in (select id from public.skillfirms_courses where expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid())))));
create policy "admins manage quiz questions" on public.skillfirms_module_quiz_questions for all
  using (public.skillfirms_is_admin()) with check (public.skillfirms_is_admin());

revoke select on public.skillfirms_module_quiz_questions from anon, authenticated;
grant select (id, module_id, order_index, question, choices) on public.skillfirms_module_quiz_questions to anon, authenticated;

create table public.skillfirms_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'dropped')),
  progress_percent numeric not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint skillfirms_enrollments_unique unique (user_id, course_id)
);
create index skillfirms_enrollments_user_idx on public.skillfirms_enrollments(user_id);
alter table public.skillfirms_enrollments enable row level security;
create policy "users manage their own enrollments" on public.skillfirms_enrollments for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "experts see enrollments in their own courses" on public.skillfirms_enrollments for select
  using (course_id in (select id from public.skillfirms_courses where expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid()))));

-- enrollment_count is an aggregate other users rely on to judge course
-- quality -- it must never be client-writable, so it only ever changes
-- via this trigger, not a direct update from the frontend.
create or replace function public.skillfirms_bump_enrollment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.skillfirms_courses set enrollment_count = enrollment_count + 1 where id = new.course_id;
  elsif tg_op = 'DELETE' then
    update public.skillfirms_courses set enrollment_count = enrollment_count - 1 where id = old.course_id;
  end if;
  return null;
end;
$$;
create trigger skillfirms_enrollments_bump_count
  after insert or delete on public.skillfirms_enrollments
  for each row execute function public.skillfirms_bump_enrollment_count();

create table public.skillfirms_module_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.skillfirms_enrollments(id) on delete cascade,
  module_id uuid not null references public.skillfirms_course_modules(id) on delete cascade,
  completed_at timestamptz,
  quiz_score numeric check (quiz_score is null or (quiz_score >= 0 and quiz_score <= 1)),
  constraint skillfirms_module_progress_unique unique (enrollment_id, module_id)
);
alter table public.skillfirms_module_progress enable row level security;
create policy "users manage progress on their own enrollments" on public.skillfirms_module_progress for all
  using (enrollment_id in (select id from public.skillfirms_enrollments where user_id = (select auth.uid())))
  with check (enrollment_id in (select id from public.skillfirms_enrollments where user_id = (select auth.uid())));

-- One path per goal (section 9: assembled from multiple experts' courses,
-- never a plain browse-all list). Regenerating a goal's path replaces its
-- items rather than accumulating stale ones as proficiency changes.
create table public.skillfirms_user_learning_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null references public.skillfirms_user_career_goals(id) on delete cascade,
  target_role_id uuid not null references public.skillfirms_career_roles(id),
  created_at timestamptz not null default now(),
  constraint skillfirms_user_learning_paths_unique unique (user_id, goal_id)
);
alter table public.skillfirms_user_learning_paths enable row level security;
create policy "users manage their own learning paths" on public.skillfirms_user_learning_paths for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- gap_weight is stored so the UI can always answer "why is this course
-- in my path" after the fact, same explainability discipline as readiness.
create table public.skillfirms_path_items (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.skillfirms_user_learning_paths(id) on delete cascade,
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  order_index integer not null check (order_index >= 0),
  primary_skill_id uuid not null references public.skillfirms_skills(id),
  gap_weight numeric not null check (gap_weight > 0),
  constraint skillfirms_path_items_unique unique (path_id, course_id)
);
alter table public.skillfirms_path_items enable row level security;
create policy "users manage their own path items" on public.skillfirms_path_items for all
  using (path_id in (select id from public.skillfirms_user_learning_paths where user_id = (select auth.uid())))
  with check (path_id in (select id from public.skillfirms_user_learning_paths where user_id = (select auth.uid())));
