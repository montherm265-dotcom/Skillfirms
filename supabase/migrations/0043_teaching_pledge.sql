-- Employer conflict-of-interest safeguard. Tutors are verified by their real
-- job (often at a well-known company), so before a course is sent for
-- review the tutor confirms, for that course:
--   1. it teaches general industry skills and public tools, not their
--      employer's (or anyone's) confidential information or internal
--      workflows;
--   2. their employment contract allows outside teaching;
--   3. it doesn't present itself as made or endorsed by their employer.
-- The time of that confirmation is kept on the course; a course can't be
-- sent for review without it.
alter table public.skillfirms_courses add column if not exists teaching_pledge_at timestamptz;

create or replace function public.skillfirms_accept_teaching_pledge(p_course_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.skillfirms_courses := public._skillfirms_my_course(p_course_id);
begin
  if v_c.id is null then raise exception 'not_yours'; end if;
  update public.skillfirms_courses set teaching_pledge_at = now() where id = v_c.id;
end;
$$;
revoke all on function public.skillfirms_accept_teaching_pledge(uuid) from public, anon;
grant execute on function public.skillfirms_accept_teaching_pledge(uuid) to authenticated;

select public._edit_fn('public.skillfirms_studio_submit(uuid)'::regprocedure, array[array[
  $a$  if v_c.status = 'published' then raise exception 'already_published'; end if;$a$,
  $b$  if v_c.status = 'published' then raise exception 'already_published'; end if;
  if v_c.teaching_pledge_at is null then
    raise exception 'teaching_pledge: confirm the course teaches general skills and public tools (nothing confidential) and that your employment contract allows outside teaching';
  end if;$b$]]);
