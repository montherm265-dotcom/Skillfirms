begin;
select set_config('t.p', (select id::text from profiles where id not in (select profile_id from employment_verifications where status='confirmed') and id not in (select user_id from employer_confirmations where status='confirmed') order by id limit 1), false);
do $$ begin
  if public.skillfirms_is_practitioner(current_setting('t.p')::uuid) then raise exception 'FAIL: practitioner without proof'; end if;
  if public.skillfirms_course_outcomes((select id from skillfirms_courses limit 1)) is not null then raise exception 'FAIL: outcomes shown below 5'; end if;
  raise notice 'PASS: practitioner needs confirmed experience; outcomes hidden below 5 certified';
end $$;
rollback;
