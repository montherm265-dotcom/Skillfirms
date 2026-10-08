-- Performance advisor: 17 Skillfirms tables each had an admin-ALL policy
-- (and sometimes an owner-ALL policy too) overlapping with a separate
-- read or owner policy for the SAME role+command, so Postgres evaluates
-- 2-3 permissive policies per query where 1 would do. Pure performance
-- cleanup: every merged policy below is the exact OR of the conditions
-- it replaces, so access behavior is unchanged -- verified table-by-table
-- in a rolled-back transaction before this was written.
--
-- Also drops the leftover `zz_test_policy_delete_me` test artifact on
-- skillfirms_user_skill_state (qual false, contributed nothing, just
-- extra eval overhead).

-- ---- skillfirms_career_roles (admin ALL + public true SELECT) ----
drop policy if exists "admins manage career roles" on public.skillfirms_career_roles;
create policy "admins insert career roles" on public.skillfirms_career_roles for insert with check (skillfirms_is_admin());
create policy "admins update career roles" on public.skillfirms_career_roles for update using (skillfirms_is_admin()) with check (skillfirms_is_admin());
create policy "admins delete career roles" on public.skillfirms_career_roles for delete using (skillfirms_is_admin());

-- ---- skillfirms_mission_skills (admin ALL + public true SELECT) ----
drop policy if exists "admins manage mission skills" on public.skillfirms_mission_skills;
create policy "admins insert mission skills" on public.skillfirms_mission_skills for insert with check (skillfirms_is_admin());
create policy "admins update mission skills" on public.skillfirms_mission_skills for update using (skillfirms_is_admin()) with check (skillfirms_is_admin());
create policy "admins delete mission skills" on public.skillfirms_mission_skills for delete using (skillfirms_is_admin());

-- ---- skillfirms_role_progressions (admin ALL + public true SELECT) ----
drop policy if exists "admins manage role progressions" on public.skillfirms_role_progressions;
create policy "admins insert role progressions" on public.skillfirms_role_progressions for insert with check (skillfirms_is_admin());
create policy "admins update role progressions" on public.skillfirms_role_progressions for update using (skillfirms_is_admin()) with check (skillfirms_is_admin());
create policy "admins delete role progressions" on public.skillfirms_role_progressions for delete using (skillfirms_is_admin());

-- ---- skillfirms_role_skills (admin ALL + public true SELECT) ----
drop policy if exists "admins manage role skills" on public.skillfirms_role_skills;
create policy "admins insert role skills" on public.skillfirms_role_skills for insert with check (skillfirms_is_admin());
create policy "admins update role skills" on public.skillfirms_role_skills for update using (skillfirms_is_admin()) with check (skillfirms_is_admin());
create policy "admins delete role skills" on public.skillfirms_role_skills for delete using (skillfirms_is_admin());

-- ---- skillfirms_skill_relationships (admin ALL + public true SELECT) ----
drop policy if exists "admins manage skill relationships" on public.skillfirms_skill_relationships;
create policy "admins insert skill relationships" on public.skillfirms_skill_relationships for insert with check (skillfirms_is_admin());
create policy "admins update skill relationships" on public.skillfirms_skill_relationships for update using (skillfirms_is_admin()) with check (skillfirms_is_admin());
create policy "admins delete skill relationships" on public.skillfirms_skill_relationships for delete using (skillfirms_is_admin());

-- ---- skillfirms_skills (admin ALL + public true SELECT) ----
drop policy if exists "admins manage skills" on public.skillfirms_skills;
create policy "admins insert skills" on public.skillfirms_skills for insert with check (skillfirms_is_admin());
create policy "admins update skills" on public.skillfirms_skills for update using (skillfirms_is_admin()) with check (skillfirms_is_admin());
create policy "admins delete skills" on public.skillfirms_skills for delete using (skillfirms_is_admin());

-- ---- skillfirms_missions (admin ALL + public SELECT status='published') ----
drop policy if exists "admins manage missions" on public.skillfirms_missions;
drop policy if exists "published missions are publicly readable" on public.skillfirms_missions;
create policy "missions read access" on public.skillfirms_missions for select using (
  skillfirms_is_admin() or status = 'published'
);
create policy "admins insert missions" on public.skillfirms_missions for insert with check (skillfirms_is_admin());
create policy "admins update missions" on public.skillfirms_missions for update using (skillfirms_is_admin()) with check (skillfirms_is_admin());
create policy "admins delete missions" on public.skillfirms_missions for delete using (skillfirms_is_admin());

-- ---- skillfirms_course_skills (admin ALL + expert ALL + public true SELECT) ----
drop policy if exists "admins manage course skills" on public.skillfirms_course_skills;
drop policy if exists "experts manage their own course skills" on public.skillfirms_course_skills;
create policy "admins and experts insert course skills" on public.skillfirms_course_skills for insert with check (
  skillfirms_is_admin()
  or course_id in (select id from skillfirms_courses where expert_id in (select id from skillfirms_experts where profile_id = (select auth.uid())))
);
create policy "admins and experts update course skills" on public.skillfirms_course_skills for update using (
  skillfirms_is_admin()
  or course_id in (select id from skillfirms_courses where expert_id in (select id from skillfirms_experts where profile_id = (select auth.uid())))
) with check (
  skillfirms_is_admin()
  or course_id in (select id from skillfirms_courses where expert_id in (select id from skillfirms_experts where profile_id = (select auth.uid())))
);
create policy "admins and experts delete course skills" on public.skillfirms_course_skills for delete using (
  skillfirms_is_admin()
  or course_id in (select id from skillfirms_courses where expert_id in (select id from skillfirms_experts where profile_id = (select auth.uid())))
);

-- ---- skillfirms_module_quiz_questions (admin ALL + expert ALL + public true SELECT) ----
drop policy if exists "admins manage quiz questions" on public.skillfirms_module_quiz_questions;
drop policy if exists "experts manage their own quiz questions" on public.skillfirms_module_quiz_questions;
create policy "admins and experts insert quiz questions" on public.skillfirms_module_quiz_questions for insert with check (
  skillfirms_is_admin()
  or module_id in (select skillfirms_course_modules.id from skillfirms_course_modules
      where skillfirms_course_modules.course_id in (select skillfirms_courses.id from skillfirms_courses
        where skillfirms_courses.expert_id in (select skillfirms_experts.id from skillfirms_experts
          where skillfirms_experts.profile_id = (select auth.uid()))))
);
create policy "admins and experts update quiz questions" on public.skillfirms_module_quiz_questions for update using (
  skillfirms_is_admin()
  or module_id in (select skillfirms_course_modules.id from skillfirms_course_modules
      where skillfirms_course_modules.course_id in (select skillfirms_courses.id from skillfirms_courses
        where skillfirms_courses.expert_id in (select skillfirms_experts.id from skillfirms_experts
          where skillfirms_experts.profile_id = (select auth.uid()))))
) with check (
  skillfirms_is_admin()
  or module_id in (select skillfirms_course_modules.id from skillfirms_course_modules
      where skillfirms_course_modules.course_id in (select skillfirms_courses.id from skillfirms_courses
        where skillfirms_courses.expert_id in (select skillfirms_experts.id from skillfirms_experts
          where skillfirms_experts.profile_id = (select auth.uid()))))
);
create policy "admins and experts delete quiz questions" on public.skillfirms_module_quiz_questions for delete using (
  skillfirms_is_admin()
  or module_id in (select skillfirms_course_modules.id from skillfirms_course_modules
      where skillfirms_course_modules.course_id in (select skillfirms_courses.id from skillfirms_courses
        where skillfirms_courses.expert_id in (select skillfirms_experts.id from skillfirms_experts
          where skillfirms_experts.profile_id = (select auth.uid()))))
);

-- ---- skillfirms_course_modules (admin ALL + expert ALL + conditional SELECT) ----
drop policy if exists "admins manage modules" on public.skillfirms_course_modules;
drop policy if exists "experts manage their own modules" on public.skillfirms_course_modules;
drop policy if exists "modules of visible courses are readable" on public.skillfirms_course_modules;
create policy "course modules read access" on public.skillfirms_course_modules for select using (
  skillfirms_is_admin()
  or course_id in (select skillfirms_courses.id from skillfirms_courses where skillfirms_courses.expert_id in (select skillfirms_experts.id from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid())))
  or course_id in (select skillfirms_courses.id from skillfirms_courses)
);
create policy "admins and experts insert modules" on public.skillfirms_course_modules for insert with check (
  skillfirms_is_admin()
  or course_id in (select skillfirms_courses.id from skillfirms_courses where skillfirms_courses.expert_id in (select skillfirms_experts.id from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid())))
);
create policy "admins and experts update modules" on public.skillfirms_course_modules for update using (
  skillfirms_is_admin()
  or course_id in (select skillfirms_courses.id from skillfirms_courses where skillfirms_courses.expert_id in (select skillfirms_experts.id from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid())))
) with check (
  skillfirms_is_admin()
  or course_id in (select skillfirms_courses.id from skillfirms_courses where skillfirms_courses.expert_id in (select skillfirms_experts.id from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid())))
);
create policy "admins and experts delete modules" on public.skillfirms_course_modules for delete using (
  skillfirms_is_admin()
  or course_id in (select skillfirms_courses.id from skillfirms_courses where skillfirms_courses.expert_id in (select skillfirms_experts.id from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid())))
);

-- ---- skillfirms_courses (admin ALL + granular expert policies + conditional SELECT) ----
drop policy if exists "admins manage courses" on public.skillfirms_courses;
drop policy if exists "experts delete their own courses" on public.skillfirms_courses;
drop policy if exists "experts manage their own courses" on public.skillfirms_courses;
drop policy if exists "published courses are publicly readable" on public.skillfirms_courses;
drop policy if exists "experts update their own courses" on public.skillfirms_courses;
create policy "courses read access" on public.skillfirms_courses for select using (
  skillfirms_is_admin()
  or status = 'published'
  or expert_id in (select skillfirms_experts.id from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid()))
);
create policy "admins and experts insert courses" on public.skillfirms_courses for insert with check (
  skillfirms_is_admin()
  or expert_id in (select skillfirms_experts.id from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid()))
);
create policy "admins and experts update courses" on public.skillfirms_courses for update using (
  skillfirms_is_admin()
  or expert_id in (select skillfirms_experts.id from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid()))
) with check (
  skillfirms_is_admin()
  or expert_id in (select skillfirms_experts.id from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid()))
);
create policy "admins and experts delete courses" on public.skillfirms_courses for delete using (
  skillfirms_is_admin()
  or expert_id in (select skillfirms_experts.id from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid()))
);

-- ---- skillfirms_experts (admin ALL + owner ALL + public true SELECT) ----
drop policy if exists "admins manage experts" on public.skillfirms_experts;
drop policy if exists "experts manage their own profile" on public.skillfirms_experts;
create policy "admins and self insert experts" on public.skillfirms_experts for insert with check (
  skillfirms_is_admin() or profile_id = (select auth.uid())
);
create policy "admins and self update experts" on public.skillfirms_experts for update using (
  skillfirms_is_admin() or profile_id = (select auth.uid())
) with check (
  skillfirms_is_admin() or profile_id = (select auth.uid())
);
create policy "admins and self delete experts" on public.skillfirms_experts for delete using (
  skillfirms_is_admin() or profile_id = (select auth.uid())
);

-- ---- skillfirms_credentials (admin ALL + 2 owner/shared SELECT policies) ----
drop policy if exists "admins manage credentials" on public.skillfirms_credentials;
drop policy if exists "shared active credentials are publicly readable" on public.skillfirms_credentials;
drop policy if exists "users see their own credentials" on public.skillfirms_credentials;
create policy "credentials read access" on public.skillfirms_credentials for select using (
  skillfirms_is_admin()
  or (status = 'active_verified' and skillfirms_shares_credentials_with_talfirms(user_id))
  or user_id = (select auth.uid())
);
create policy "admins insert credentials" on public.skillfirms_credentials for insert with check (skillfirms_is_admin());
create policy "admins update credentials" on public.skillfirms_credentials for update using (skillfirms_is_admin()) with check (skillfirms_is_admin());
create policy "admins delete credentials" on public.skillfirms_credentials for delete using (skillfirms_is_admin());

-- ---- skillfirms_enrollments (owner ALL + expert SELECT, no admin policy) ----
drop policy if exists "users manage their own enrollments" on public.skillfirms_enrollments;
drop policy if exists "experts see enrollments in their own courses" on public.skillfirms_enrollments;
create policy "enrollments read access" on public.skillfirms_enrollments for select using (
  user_id = (select auth.uid())
  or course_id in (select skillfirms_courses.id from skillfirms_courses where skillfirms_courses.expert_id in (select skillfirms_experts.id from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid())))
);
create policy "users insert their own enrollments" on public.skillfirms_enrollments for insert with check (user_id = (select auth.uid()));
create policy "users update their own enrollments" on public.skillfirms_enrollments for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users delete their own enrollments" on public.skillfirms_enrollments for delete using (user_id = (select auth.uid()));

-- ---- skillfirms_mission_evaluations (2 SELECT policies, no admin/UD policy at all) ----
drop policy if exists "experts see evaluations too" on public.skillfirms_mission_evaluations;
drop policy if exists "users see evaluations on their own submissions" on public.skillfirms_mission_evaluations;
create policy "mission evaluations read access" on public.skillfirms_mission_evaluations for select using (
  exists (select 1 from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid()))
  or submission_id in (select skillfirms_mission_submissions.id from skillfirms_mission_submissions where skillfirms_mission_submissions.user_id = (select auth.uid()))
);
-- "users record their own ai evaluation" (INSERT) is untouched -- it was already the only policy for its command.

-- ---- skillfirms_mission_submissions (owner ALL + expert SELECT, no admin policy) ----
drop policy if exists "users manage their own submissions" on public.skillfirms_mission_submissions;
drop policy if exists "experts can see submissions pending review" on public.skillfirms_mission_submissions;
create policy "mission submissions read access" on public.skillfirms_mission_submissions for select using (
  user_id = (select auth.uid())
  or exists (select 1 from skillfirms_experts where skillfirms_experts.profile_id = (select auth.uid()))
);
create policy "users insert their own submissions" on public.skillfirms_mission_submissions for insert with check (
  user_id = (select auth.uid()) and status = any (array['submitted', 'ai_evaluated', 'expert_requested'])
);
create policy "users update their own submissions" on public.skillfirms_mission_submissions for update using (
  user_id = (select auth.uid())
) with check (
  user_id = (select auth.uid()) and status = any (array['submitted', 'ai_evaluated', 'expert_requested'])
);
create policy "users delete their own submissions" on public.skillfirms_mission_submissions for delete using (
  user_id = (select auth.uid())
);

-- ---- skillfirms_user_skill_state (deny-all ALL + owner SELECT + leftover test policy) ----
drop policy if exists "users manage their own skill state" on public.skillfirms_user_skill_state;
drop policy if exists "zz_test_policy_delete_me" on public.skillfirms_user_skill_state;
-- "users see their own skill state" (SELECT, user_id = auth.uid()) stays as the sole SELECT policy.
-- Direct client writes stay fully denied -- all writes go through skillfirms_apply_skill_estimate
-- under the postgres owner, which bypasses RLS entirely (table is not FORCE ROW LEVEL SECURITY).
create policy "deny direct inserts to skill state" on public.skillfirms_user_skill_state for insert with check (false);
create policy "deny direct updates to skill state" on public.skillfirms_user_skill_state for update using (false) with check (false);
create policy "deny direct deletes from skill state" on public.skillfirms_user_skill_state for delete using (false);
