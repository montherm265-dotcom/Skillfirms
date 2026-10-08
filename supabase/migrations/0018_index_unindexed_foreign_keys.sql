-- Same performance advisor pass as the Talfirms side: 20 foreign-key
-- columns here with no covering index. Purely additive, no behavior
-- change -- just makes the obvious join/filter columns fast.

create index if not exists idx_skillfirms_skill_relationships_related_skill_id on public.skillfirms_skill_relationships (related_skill_id);
create index if not exists idx_skillfirms_role_skills_skill_id on public.skillfirms_role_skills (skill_id);
create index if not exists idx_skillfirms_role_progressions_to_role_id on public.skillfirms_role_progressions (to_role_id);
create index if not exists idx_skillfirms_user_skill_state_skill_id on public.skillfirms_user_skill_state (skill_id);
create index if not exists idx_skillfirms_user_career_goals_target_role_id on public.skillfirms_user_career_goals (target_role_id);
create index if not exists idx_skillfirms_career_diagnoses_goal_id on public.skillfirms_career_diagnoses (goal_id);
create index if not exists idx_skillfirms_career_diagnoses_target_role_id on public.skillfirms_career_diagnoses (target_role_id);
create index if not exists idx_skillfirms_enrollments_course_id on public.skillfirms_enrollments (course_id);
create index if not exists idx_skillfirms_module_progress_module_id on public.skillfirms_module_progress (module_id);
create index if not exists idx_skillfirms_user_learning_paths_goal_id on public.skillfirms_user_learning_paths (goal_id);
create index if not exists idx_skillfirms_user_learning_paths_target_role_id on public.skillfirms_user_learning_paths (target_role_id);
create index if not exists idx_skillfirms_path_items_course_id on public.skillfirms_path_items (course_id);
create index if not exists idx_skillfirms_path_items_primary_skill_id on public.skillfirms_path_items (primary_skill_id);
create index if not exists idx_skillfirms_missions_role_id on public.skillfirms_missions (role_id);
create index if not exists idx_skillfirms_mission_skills_skill_id on public.skillfirms_mission_skills (skill_id);
create index if not exists idx_skillfirms_mission_submissions_mission_id on public.skillfirms_mission_submissions (mission_id);
create index if not exists idx_skillfirms_mission_evaluations_expert_id on public.skillfirms_mission_evaluations (expert_id);
create index if not exists idx_skillfirms_credentials_course_id on public.skillfirms_credentials (course_id);
create index if not exists idx_skillfirms_credentials_mission_id on public.skillfirms_credentials (mission_id);
create index if not exists idx_skillfirms_credentials_superseded_by on public.skillfirms_credentials (superseded_by);
