-- Defense-in-depth pass following the two critical fixes in 0014/0015,
-- after re-running the Supabase security advisor. None of these four
-- functions have a legitimate anonymous (logged-out) caller, regardless
-- of whether their internal logic already guards against abuse -- same
-- standard already applied to Talfirms' approve_introduction /
-- end_workroom_live / complete_quest_step / join_workroom /
-- get_collaborator_suggestions. A future edit to one of these should
-- never be able to silently reopen anonymous access just because the
-- logic happens to still be correct.
--
-- skillfirms_record_skill_estimates: hardcodes p_source to 'ai_estimated'
-- and writes under auth.uid(), so an anonymous call can't forge another
-- user's data -- but there is still no real-world anonymous caller
-- (the AI diagnosis feature that calls this always requires login).
--
-- skillfirms_submit_quiz: requires a real enrollment row for
-- auth.uid(), which an anonymous caller never has -- still revoking
-- directly since quizzes are never taken while logged out.
--
-- skillfirms_expert_review_submission: requires a real
-- skillfirms_experts row for auth.uid(), which an anonymous caller
-- never has -- still revoking directly since expert review is never
-- done while logged out.
--
-- skillfirms_bump_enrollment_count: an enrollment-count trigger
-- function (returns trigger). It has no legitimate direct caller at
-- all, anonymous or authenticated -- it should only ever run as a
-- trigger, which fires under the table owner regardless of role grants.
revoke execute on function public.skillfirms_record_skill_estimates(text, jsonb) from anon;
revoke execute on function public.skillfirms_submit_quiz(uuid, jsonb) from anon;
revoke execute on function public.skillfirms_expert_review_submission(uuid, numeric, text, jsonb, jsonb) from anon;
revoke execute on function public.skillfirms_bump_enrollment_count() from public, anon, authenticated;

-- Both flagged by the advisor as SECURITY-mutable search_path. Neither
-- is SECURITY DEFINER, so this was never a privilege-escalation vector
-- (a hijacked search_path would only affect the caller's own
-- privileges) -- hardening anyway since it's a one-line fix and
-- generate_credential_code specifically produces the public credential
-- code, worth being unambiguous about.
alter function public.skillfirms_skill_source_rank(text) set search_path = public;
alter function public.skillfirms_generate_credential_code() set search_path = public;
