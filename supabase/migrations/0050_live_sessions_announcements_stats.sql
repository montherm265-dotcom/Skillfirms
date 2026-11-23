-- Tutors, the missing pieces:
--   1. Live sessions and group classes: the tutor schedules a session for a
--      course (title, time, length, meeting link, optional seat limit);
--      enrolled learners RSVP. The meeting link is only shown to enrolled
--      learners and the tutor.
--   2. Announcements: a message from the tutor to everyone enrolled.
--   Both notify learners (the shared Talfirms notifications, with a link
--   back to Skillfirms).
--   3. Course stats for the tutor: enrolments, how many started and
--      finished, how far learners get lesson by lesson (where they stop),
--      quiz scores, exam pass rate and rating.
-- Nothing is deleted.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'new_message','workroom_invite','contribution_verified','reference_received','capability_verified','introduction_proposed',
  'introduction_response','opportunity_match','quest_step_completed','live_work_started','connection_request','connection_accepted',
  'pipeline_stage_changed','interview_scheduled','interview_rescheduled','interview_confirmed','interview_cancelled',
  'opportunity_review_update','response_commitment_breach','milestone_congratulated','match_ask','match_auto_yes','referral_hired',
  'hiring_checkin','opportunity_auto_closed','answer_questions','finish_application','profile_views_weekly','manager_confirm_request',
  'manager_confirmed','candidate_check_done','employment_confirmed','company_staff_request',
  'offer_received','offer_answered','course_announcement','live_session']));

create or replace function public._sf_owns_course(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.skillfirms_courses c join public.skillfirms_experts e on e.id = c.expert_id
                 where c.id = p_course_id and e.profile_id = auth.uid());
$$;
create or replace function public._sf_enrolled(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.skillfirms_enrollments where course_id = p_course_id and user_id = auth.uid());
$$;
revoke all on function public._sf_owns_course(uuid) from public, anon;
revoke all on function public._sf_enrolled(uuid) from public, anon;

create table if not exists public.skillfirms_course_announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 2 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists sf_announcements_course_idx on public.skillfirms_course_announcements (course_id, created_at desc);
alter table public.skillfirms_course_announcements enable row level security;
revoke all on public.skillfirms_course_announcements from anon, authenticated;

create table if not exists public.skillfirms_live_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  details text check (char_length(details) <= 2000),
  starts_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes between 15 and 480),
  meeting_url text not null check (meeting_url ~* '^https://[^\s]+$' and char_length(meeting_url) <= 500),
  capacity int check (capacity is null or capacity between 1 and 10000),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists sf_sessions_course_idx on public.skillfirms_live_sessions (course_id, starts_at);
alter table public.skillfirms_live_sessions enable row level security;
revoke all on public.skillfirms_live_sessions from anon, authenticated;

create table if not exists public.skillfirms_session_rsvps (
  session_id uuid not null references public.skillfirms_live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  going boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
alter table public.skillfirms_session_rsvps enable row level security;
revoke all on public.skillfirms_session_rsvps from anon, authenticated;

-- Tell everyone enrolled (not the tutor).
create or replace function public._sf_notify_enrolled(p_course_id uuid, p_type text, p_payload jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, payload)
  select e.user_id, p_type, p_payload || jsonb_build_object('course_title', c.title, 'url', 'https://skillfirms.montherm265.workers.dev/courses/' || c.slug)
  from public.skillfirms_enrollments e join public.skillfirms_courses c on c.id = e.course_id
  where e.course_id = p_course_id and e.user_id is distinct from auth.uid();
$$;
revoke all on function public._sf_notify_enrolled(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.sf_post_announcement(p_course_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._sf_owns_course(p_course_id) then raise exception 'only the course tutor can post to its learners'; end if;
  if (select count(*) from public.skillfirms_course_announcements where course_id = p_course_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'busy: at most 5 announcements a day per course';
  end if;
  insert into public.skillfirms_course_announcements (course_id, author_id, body) values (p_course_id, auth.uid(), btrim(p_body)) returning id into v_id;
  perform public._sf_notify_enrolled(p_course_id, 'course_announcement', jsonb_build_object('announcement_id', v_id, 'preview', left(btrim(p_body), 140)));
  return v_id;
end;
$$;
revoke all on function public.sf_post_announcement(uuid, text) from public, anon;
grant execute on function public.sf_post_announcement(uuid, text) to authenticated;

create or replace function public.sf_schedule_session(p_course_id uuid, p_title text, p_details text, p_starts_at timestamptz,
  p_duration_minutes int, p_meeting_url text, p_capacity int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._sf_owns_course(p_course_id) then raise exception 'only the course tutor can schedule a session'; end if;
  if p_starts_at <= now() then raise exception 'starts_at: pick a time in the future'; end if;
  insert into public.skillfirms_live_sessions (course_id, title, details, starts_at, duration_minutes, meeting_url, capacity)
  values (p_course_id, btrim(p_title), nullif(btrim(coalesce(p_details, '')), ''), p_starts_at, coalesce(p_duration_minutes, 60), btrim(p_meeting_url), p_capacity)
  returning id into v_id;
  perform public._sf_notify_enrolled(p_course_id, 'live_session', jsonb_build_object('session_id', v_id, 'title', btrim(p_title), 'starts_at', p_starts_at));
  return v_id;
end;
$$;
revoke all on function public.sf_schedule_session(uuid, text, text, timestamptz, int, text, int) from public, anon;
grant execute on function public.sf_schedule_session(uuid, text, text, timestamptz, int, text, int) to authenticated;

create or replace function public.sf_cancel_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.skillfirms_live_sessions;
begin
  select * into s from public.skillfirms_live_sessions where id = p_session_id;
  if s.id is null or not public._sf_owns_course(s.course_id) then raise exception 'session not found'; end if;
  update public.skillfirms_live_sessions set status = 'cancelled' where id = s.id;
  insert into public.notifications (user_id, type, payload)
  select r.user_id, 'live_session', jsonb_build_object('session_id', s.id, 'title', s.title, 'starts_at', s.starts_at, 'cancelled', true,
    'course_title', c.title, 'url', 'https://skillfirms.montherm265.workers.dev/courses/' || c.slug)
  from public.skillfirms_session_rsvps r join public.skillfirms_courses c on c.id = s.course_id where r.session_id = s.id and r.going;
end;
$$;
revoke all on function public.sf_cancel_session(uuid) from public, anon;
grant execute on function public.sf_cancel_session(uuid) to authenticated;

create or replace function public.sf_rsvp(p_session_id uuid, p_going boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s public.skillfirms_live_sessions;
begin
  select * into s from public.skillfirms_live_sessions where id = p_session_id for update;
  if s.id is null or s.status <> 'scheduled' then raise exception 'session not found'; end if;
  if not public._sf_enrolled(s.course_id) then raise exception 'enrol in the course to join its live sessions'; end if;
  if p_going then
    if s.capacity is not null and (select count(*) from public.skillfirms_session_rsvps where session_id = s.id and going) >= s.capacity
       and not exists (select 1 from public.skillfirms_session_rsvps where session_id = s.id and user_id = auth.uid() and going) then
      raise exception 'full: this session is full';
    end if;
  end if;
  insert into public.skillfirms_session_rsvps (session_id, user_id, going) values (s.id, auth.uid(), p_going)
  on conflict (session_id, user_id) do update set going = excluded.going;
end;
$$;
revoke all on function public.sf_rsvp(uuid, boolean) from public, anon;
grant execute on function public.sf_rsvp(uuid, boolean) to authenticated;

-- What a course page shows: announcements and sessions. Links only for
-- enrolled learners and the tutor.
create or replace function public.sf_course_updates(p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner boolean := public._sf_owns_course(p_course_id); v_in boolean := public._sf_enrolled(p_course_id);
begin
  return jsonb_build_object(
    'owner', v_owner, 'enrolled', v_in,
    'announcements', case when v_owner or v_in then coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'body', a.body, 'at', a.created_at) order by a.created_at desc)
      from (select * from public.skillfirms_course_announcements where course_id = p_course_id order by created_at desc limit 20) a), '[]'::jsonb) else '[]'::jsonb end,
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'details', s.details, 'starts_at', s.starts_at,
        'duration_minutes', s.duration_minutes, 'capacity', s.capacity,
        'meeting_url', case when v_owner or v_in then s.meeting_url end,
        'going', (select count(*) from public.skillfirms_session_rsvps r where r.session_id = s.id and r.going),
        'mine', exists (select 1 from public.skillfirms_session_rsvps r where r.session_id = s.id and r.user_id = auth.uid() and r.going)) order by s.starts_at)
      from public.skillfirms_live_sessions s
      where s.course_id = p_course_id and s.status = 'scheduled' and s.starts_at + make_interval(mins => s.duration_minutes) > now()), '[]'::jsonb));
end;
$$;
grant execute on function public.sf_course_updates(uuid) to anon, authenticated;

-- The learner's dashboard: upcoming sessions and recent announcements from
-- every course they're enrolled in.
create or replace function public.sf_my_updates()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(x order by x->>'starts_at') from (
      select jsonb_build_object('id', s.id, 'title', s.title, 'starts_at', s.starts_at, 'duration_minutes', s.duration_minutes,
        'meeting_url', s.meeting_url, 'course', c.title, 'slug', c.slug,
        'mine', exists (select 1 from public.skillfirms_session_rsvps r where r.session_id = s.id and r.user_id = auth.uid() and r.going)) x
      from public.skillfirms_live_sessions s join public.skillfirms_courses c on c.id = s.course_id
      join public.skillfirms_enrollments e on e.course_id = s.course_id and e.user_id = auth.uid()
      where s.status = 'scheduled' and s.starts_at + make_interval(mins => s.duration_minutes) > now()
      order by s.starts_at limit 5) q), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(x order by x->>'at' desc) from (
      select jsonb_build_object('id', a.id, 'body', a.body, 'at', a.created_at, 'course', c.title, 'slug', c.slug) x
      from public.skillfirms_course_announcements a join public.skillfirms_courses c on c.id = a.course_id
      join public.skillfirms_enrollments e on e.course_id = a.course_id and e.user_id = auth.uid()
      where a.created_at > now() - interval '30 days'
      order by a.created_at desc limit 5) q), '[]'::jsonb));
$$;
revoke all on function public.sf_my_updates() from public, anon;
grant execute on function public.sf_my_updates() to authenticated;

-- The tutor's course stats. Counts only, never who.
create or replace function public.sf_course_stats(p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_enrolled int; v_started int; v_done int;
begin
  if not public._sf_owns_course(p_course_id) then return null; end if;
  select count(*) into v_enrolled from public.skillfirms_enrollments where course_id = p_course_id;
  select count(distinct e.id) into v_started from public.skillfirms_enrollments e join public.skillfirms_module_progress mp on mp.enrollment_id = e.id
   where e.course_id = p_course_id and mp.completed_at is not null;
  select count(*) into v_done from public.skillfirms_enrollments where course_id = p_course_id and completed_at is not null;
  return jsonb_build_object(
    'enrolled', v_enrolled, 'started', v_started, 'completed', v_done,
    'completion_pct', case when v_enrolled > 0 then round(100.0 * v_done / v_enrolled) end,
    'last_30_days', (select count(*) from public.skillfirms_enrollments where course_id = p_course_id and enrolled_at > now() - interval '30 days'),
    'rating', (select jsonb_build_object('avg', rating_avg, 'count', rating_count) from public.skillfirms_courses where id = p_course_id),
    'exam', (select jsonb_build_object('passed', count(*) filter (where status = 'passed'), 'failed', count(*) filter (where status = 'failed'),
        'marking', count(*) filter (where status = 'marking')) from public.skillfirms_exam_attempts where course_id = p_course_id),
    'lessons', coalesce((select jsonb_agg(jsonb_build_object('n', m.order_index, 'title', m.title,
        'reached', (select count(*) from public.skillfirms_module_progress mp join public.skillfirms_enrollments e on e.id = mp.enrollment_id
                    where mp.module_id = m.id and e.course_id = p_course_id and mp.completed_at is not null),
        'quiz_avg', (select round(avg(mp.quiz_score)) from public.skillfirms_module_progress mp where mp.module_id = m.id and mp.quiz_score is not null))
      order by m.order_index) from public.skillfirms_course_modules m where m.course_id = p_course_id), '[]'::jsonb));
end;
$$;
revoke all on function public.sf_course_stats(uuid) from public, anon;
grant execute on function public.sf_course_stats(uuid) to authenticated;
