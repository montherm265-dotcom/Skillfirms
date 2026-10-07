-- 0001 only gave skillfirms_career_diagnoses a SELECT policy, so the
-- frontend's own call to log a diagnosis (immediately after running one)
-- would have failed outright with a bare RLS violation -- caught by a
-- functional test before this ever shipped.
create policy "users log their own diagnoses" on public.skillfirms_career_diagnoses for insert
  with check (user_id = (select auth.uid()));
