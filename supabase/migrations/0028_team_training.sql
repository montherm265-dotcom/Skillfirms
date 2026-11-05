-- Team training: companies train their own people on Skillfirms.
--
-- A company manager (Talfirms can_manage_company) makes an invite link.
-- Staff join with it, agreeing that the company sees their progress and
-- certificates in the courses the company assigns (never their notes,
-- tutor chats or other courses). Managers assign courses (to everyone or
-- one person, with a due date) and see a live training record they can
-- export for audits. Seats: 3 free to try; more are $15 per person a month
-- (until Stripe is on, an admin sets a company's seat limit).

alter table public.companies add column if not exists training_seat_limit integer not null default 3 check (training_seat_limit between 0 and 100000);
insert into public.ad_pricing (key, cents, label) values ('team_seat_month', 1500, 'Team training: per person per month')
on conflict (key) do nothing;

create table if not exists public.skillfirms_team_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (company_id, profile_id)
);
create index if not exists skillfirms_team_members_profile_idx on public.skillfirms_team_members (profile_id);

create table if not exists public.skillfirms_team_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references public.profiles(id) on delete set null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists skillfirms_team_invites_company_idx on public.skillfirms_team_invites (company_id);

create table if not exists public.skillfirms_team_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade, -- null = everyone in the team
  due_on date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists skillfirms_team_assignments_unique on public.skillfirms_team_assignments
  (company_id, course_id, coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.skillfirms_team_members enable row level security;
alter table public.skillfirms_team_invites enable row level security;
alter table public.skillfirms_team_assignments enable row level security;
-- Everything goes through the functions below.
revoke all on public.skillfirms_team_members, public.skillfirms_team_invites, public.skillfirms_team_assignments from anon, authenticated;

-- Enrol a person in a course (training assignment), quietly if already enrolled.
create or replace function public._skillfirms_enrol(p_profile uuid, p_course uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.skillfirms_enrollments (user_id, course_id) values (p_profile, p_course)
  on conflict (user_id, course_id) do nothing;
$$;
revoke all on function public._skillfirms_enrol(uuid, uuid) from public, anon, authenticated;

create or replace function public.skillfirms_my_teams()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'logo_url', c.logo_url,
           'manager', public.can_manage_company(c.id),
           'member', exists (select 1 from public.skillfirms_team_members m where m.company_id = c.id and m.profile_id = auth.uid()))
         order by c.name), '[]'::jsonb)
  from public.companies c
  where auth.uid() is not null and coalesce(c.confidential, false) = false
    and (exists (select 1 from public.company_members cm where cm.company_id = c.id and cm.user_id = auth.uid() and public.can_manage_company(c.id))
         or exists (select 1 from public.skillfirms_team_members m where m.company_id = c.id and m.profile_id = auth.uid()));
$$;
revoke all on function public.skillfirms_my_teams() from public, anon;
grant execute on function public.skillfirms_my_teams() to authenticated;

create or replace function public.skillfirms_team_invite_link(p_company_id uuid, p_new boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.can_manage_company(p_company_id) then raise exception 'managers_only'; end if;
  if p_new then update public.skillfirms_team_invites set revoked = true where company_id = p_company_id and not revoked; end if;
  select code into v_code from public.skillfirms_team_invites where company_id = p_company_id and not revoked order by created_at desc limit 1;
  if v_code is null then
    insert into public.skillfirms_team_invites (company_id, created_by) values (p_company_id, auth.uid()) returning code into v_code;
  end if;
  return v_code;
end;
$$;
revoke all on function public.skillfirms_team_invite_link(uuid, boolean) from public, anon;
grant execute on function public.skillfirms_team_invite_link(uuid, boolean) to authenticated;

create or replace function public.skillfirms_team_invite_info(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('company', c.name, 'slug', c.slug, 'logo_url', c.logo_url,
    'seats_left', greatest(c.training_seat_limit - (select count(*) from public.skillfirms_team_members m where m.company_id = c.id), 0),
    'member', exists (select 1 from public.skillfirms_team_members m where m.company_id = c.id and m.profile_id = auth.uid()),
    'courses', (select count(distinct course_id) from public.skillfirms_team_assignments a where a.company_id = c.id))
  from public.skillfirms_team_invites i join public.companies c on c.id = i.company_id
  where i.code = p_code and not i.revoked;
$$;
revoke all on function public.skillfirms_team_invite_info(text) from public;
grant execute on function public.skillfirms_team_invite_info(text) to anon, authenticated;

create or replace function public.skillfirms_team_join(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_limit int;
  v_a record;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select i.company_id, c.training_seat_limit into v_company, v_limit
  from public.skillfirms_team_invites i join public.companies c on c.id = i.company_id
  where i.code = p_code and not i.revoked for update of c;
  if v_company is null then raise exception 'invite_not_found: this invite link has expired or was replaced'; end if;
  if exists (select 1 from public.skillfirms_team_members where company_id = v_company and profile_id = auth.uid()) then
    return jsonb_build_object('company_id', v_company, 'already', true);
  end if;
  if (select count(*) from public.skillfirms_team_members where company_id = v_company) >= v_limit then
    raise exception 'seats_full: your company''s training seats are full. Ask your manager to add seats.';
  end if;
  perform public.check_rate_limit('skillfirms_team_join', 20, 86400);
  insert into public.skillfirms_team_members (company_id, profile_id) values (v_company, auth.uid());
  for v_a in select distinct course_id from public.skillfirms_team_assignments where company_id = v_company and profile_id is null loop
    perform public._skillfirms_enrol(auth.uid(), v_a.course_id);
  end loop;
  return jsonb_build_object('company_id', v_company, 'already', false);
end;
$$;
revoke all on function public.skillfirms_team_join(text) from public, anon;
grant execute on function public.skillfirms_team_join(text) to authenticated;

create or replace function public.skillfirms_team_leave(p_company_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.skillfirms_team_members where company_id = p_company_id and profile_id = auth.uid();
$$;
revoke all on function public.skillfirms_team_leave(uuid) from public, anon;
grant execute on function public.skillfirms_team_leave(uuid) to authenticated;

create or replace function public.skillfirms_team_remove(p_company_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_company(p_company_id) then raise exception 'managers_only'; end if;
  delete from public.skillfirms_team_members where company_id = p_company_id and profile_id = p_profile_id;
  delete from public.skillfirms_team_assignments where company_id = p_company_id and profile_id = p_profile_id;
end;
$$;
revoke all on function public.skillfirms_team_remove(uuid, uuid) from public, anon;
grant execute on function public.skillfirms_team_remove(uuid, uuid) to authenticated;

create or replace function public.skillfirms_team_assign(p_company_id uuid, p_course_id uuid, p_profile_id uuid default null, p_due_on date default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_m record;
begin
  if not public.can_manage_company(p_company_id) then raise exception 'managers_only'; end if;
  if not exists (select 1 from public.skillfirms_courses where id = p_course_id and status = 'published') then raise exception 'course_not_found'; end if;
  if p_profile_id is not null and not exists (select 1 from public.skillfirms_team_members where company_id = p_company_id and profile_id = p_profile_id) then
    raise exception 'not_in_team: that person isn''t in your team'; end if;
  insert into public.skillfirms_team_assignments (company_id, course_id, profile_id, due_on, created_by)
  values (p_company_id, p_course_id, p_profile_id, p_due_on, auth.uid())
  on conflict (company_id, course_id, coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid)) do update set due_on = excluded.due_on;
  for v_m in select profile_id from public.skillfirms_team_members where company_id = p_company_id and (p_profile_id is null or profile_id = p_profile_id) loop
    perform public._skillfirms_enrol(v_m.profile_id, p_course_id);
  end loop;
end;
$$;
revoke all on function public.skillfirms_team_assign(uuid, uuid, uuid, date) from public, anon;
grant execute on function public.skillfirms_team_assign(uuid, uuid, uuid, date) to authenticated;

create or replace function public.skillfirms_team_unassign(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  select company_id into v_company from public.skillfirms_team_assignments where id = p_assignment_id;
  if v_company is null or not public.can_manage_company(v_company) then raise exception 'managers_only'; end if;
  delete from public.skillfirms_team_assignments where id = p_assignment_id;
end;
$$;
revoke all on function public.skillfirms_team_unassign(uuid) from public, anon;
grant execute on function public.skillfirms_team_unassign(uuid) to authenticated;

-- The training record: only assigned courses, only for people in the team.
create or replace function public.skillfirms_team_dashboard(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_company(p_company_id) then raise exception 'managers_only'; end if;
  return (
    with members as (
      select m.profile_id, m.joined_at, p.display_name, p.username
      from public.skillfirms_team_members m join public.profiles p on p.id = m.profile_id
      where m.company_id = p_company_id
    ), assigned as (
      -- each person x course they're assigned (personally or as everyone); the personal due date wins
      select distinct on (mb.profile_id, a.course_id) mb.profile_id, a.course_id, a.due_on, a.id assignment_id, a.profile_id is null for_everyone
      from members mb join public.skillfirms_team_assignments a
        on a.company_id = p_company_id and (a.profile_id is null or a.profile_id = mb.profile_id)
      order by mb.profile_id, a.course_id, (a.profile_id is null)
    ), rows as (
      select a.*, co.title, co.slug,
        (select count(*) from public.skillfirms_course_modules cm where cm.course_id = a.course_id) lessons,
        (select count(*) from public.skillfirms_module_progress mp join public.skillfirms_enrollments e on e.id = mp.enrollment_id
          where e.user_id = a.profile_id and e.course_id = a.course_id and mp.completed_at is not null) passed,
        (select jsonb_build_object('code', cr.credential_code, 'issued_at', cr.issued_at) from public.skillfirms_credentials cr
          where cr.user_id = a.profile_id and cr.course_id = a.course_id and cr.status = 'active_verified' limit 1) certificate
      from assigned a join public.skillfirms_courses co on co.id = a.course_id
    )
    select jsonb_build_object(
      'company', (select jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'seat_limit', c.training_seat_limit) from public.companies c where c.id = p_company_id),
      'seat_price_cents', (select cents from public.ad_pricing where key = 'team_seat_month'),
      'members', coalesce((select jsonb_agg(jsonb_build_object('id', mb.profile_id, 'name', coalesce(mb.display_name, mb.username, 'Team member'), 'username', mb.username, 'joined_at', mb.joined_at,
          'courses', coalesce((select jsonb_agg(jsonb_build_object('course_id', r.course_id, 'title', r.title, 'slug', r.slug, 'due_on', r.due_on,
                 'lessons', r.lessons, 'passed', r.passed, 'certificate', r.certificate,
                 'overdue', r.certificate is null and r.due_on is not null and r.due_on < current_date) order by r.title)
               from rows r where r.profile_id = mb.profile_id), '[]'::jsonb)) order by mb.display_name) from members mb), '[]'::jsonb),
      'assignments', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'course_id', a.course_id, 'title', co.title, 'due_on', a.due_on,
          'profile_id', a.profile_id, 'person', (select display_name from public.profiles where id = a.profile_id)) order by co.title)
        from public.skillfirms_team_assignments a join public.skillfirms_courses co on co.id = a.course_id where a.company_id = p_company_id), '[]'::jsonb)
    )
  );
end;
$$;
revoke all on function public.skillfirms_team_dashboard(uuid) from public, anon;
grant execute on function public.skillfirms_team_dashboard(uuid) to authenticated;

-- A learner's assigned courses (shown in My learning).
create or replace function public.skillfirms_my_assignments()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('course_id', x.course_id, 'company', x.company, 'due_on', x.due_on) order by x.due_on nulls last), '[]'::jsonb)
  from (
    select distinct on (a.course_id) a.course_id, c.name company, a.due_on
    from public.skillfirms_team_members m
    join public.skillfirms_team_assignments a on a.company_id = m.company_id and (a.profile_id is null or a.profile_id = m.profile_id)
    join public.companies c on c.id = m.company_id
    where m.profile_id = auth.uid()
    order by a.course_id, a.due_on nulls last
  ) x;
$$;
revoke all on function public.skillfirms_my_assignments() from public, anon;
grant execute on function public.skillfirms_my_assignments() to authenticated;

-- Admin (until Stripe is on): set how many training seats a company has.
create or replace function public.skillfirms_admin_set_seats(p_company_slug text, p_seats integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  update public.companies set training_seat_limit = greatest(0, p_seats) where slug = p_company_slug;
  if not found then raise exception 'company_not_found'; end if;
end;
$$;
revoke all on function public.skillfirms_admin_set_seats(text, integer) from public, anon;
grant execute on function public.skillfirms_admin_set_seats(text, integer) to authenticated;
