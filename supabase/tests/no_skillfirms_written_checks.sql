-- 0040: free AI basics have no quiz; a learner marks lessons done.
begin;
create temp table k as select (select id from profiles order by id limit 1) u, (select m.id from skillfirms_course_modules m join skillfirms_courses c on c.id=m.course_id where c.taught_by='ai' limit 1) m;
grant select on k to authenticated;
insert into skillfirms_enrollments (user_id, course_id) select u, (select course_id from skillfirms_course_modules where id=k.m) from k on conflict do nothing;
select set_config('request.jwt.claim.sub', (select u::text from k), true);
set role authenticated;
do $$ declare m uuid := (select m from k); begin
  if m is null then raise notice 'SKIP: no AI module locally'; return; end if;
  if not public.skillfirms_finish_lesson(m) then raise exception 'FAIL finish'; end if;
  begin perform public.skillfirms_submit_quiz(m, '{}'::jsonb); raise exception 'FAIL: quiz allowed';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; if sqlerrm not like 'no_check%' then raise exception 'FAIL wrong error %', sqlerrm; end if; end;
  raise notice 'PASS: free basics are marked done; no quiz';
end $$;
rollback;
