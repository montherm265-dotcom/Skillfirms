-- Expert-taught courses with video, sold with a 50/50 split.
--
-- Experts (admin-approved, migration 0027) build courses in the studio:
-- lessons with text, a video link (YouTube, Vimeo, Loom) or an uploaded
-- video, key points, and 3-5 graded questions each. They submit; an admin
-- approves before anything is public. Approved courses are "expert-taught",
-- which counts as verified proof on Talfirms (Talfirms migration 0232).
--
-- Price: free, or $9-$199. Paid courses: lesson 1 is a free preview; the
-- rest (and the graded checks) unlock after buying. The instructor earns
-- 50%. Until payments are on (app_flags 'skillfirms_course_sales'), buying
-- joins a waiting list and an admin can grant access (credit).
--
-- Security: course, lesson, skill and question rows can no longer be
-- written directly from the app (an expert could publish or mark a course
-- expert-taught without review); everything goes through these functions.

-- 0. Writes only through functions --------------------------------------------------------------
revoke insert, update, delete on public.skillfirms_courses, public.skillfirms_course_modules,
  public.skillfirms_course_skills, public.skillfirms_module_quiz_questions, public.skillfirms_lessons from anon, authenticated;

-- 1. Course and lesson fields --------------------------------------------------------------------
alter table public.skillfirms_courses add column if not exists price_cents integer not null default 0
  check (price_cents = 0 or price_cents between 900 and 19900);
alter table public.skillfirms_courses add column if not exists review_state text
  check (review_state in ('draft', 'submitted', 'changes_requested', 'approved'));
alter table public.skillfirms_courses add column if not exists review_note text check (char_length(review_note) <= 1000);
alter table public.skillfirms_courses add column if not exists submitted_at timestamptz;
alter table public.skillfirms_courses add column if not exists published_at timestamptz;
alter table public.skillfirms_course_modules add column if not exists video_url text
  check (video_url is null or (char_length(video_url) <= 500 and video_url ~ '^https://'));

insert into public.app_flags (key, enabled) values ('skillfirms_course_sales', false) on conflict (key) do nothing;

-- 2. Purchases ----------------------------------------------------------------------------------------
create table if not exists public.skillfirms_course_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  price_cents integer not null,
  status text not null default 'waitlist' check (status in ('waitlist', 'awaiting_payment', 'paid', 'refunded')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'credit', 'refunded')),
  instructor_share_cents integer,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index if not exists skillfirms_course_purchases_course_idx on public.skillfirms_course_purchases (course_id);
alter table public.skillfirms_course_purchases enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'skillfirms_course_purchases' and policyname = 'buyers read their own purchases') then
    create policy "buyers read their own purchases" on public.skillfirms_course_purchases for select using (user_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.skillfirms_course_purchases from anon;
revoke insert, update, delete on public.skillfirms_course_purchases from authenticated;
grant select on public.skillfirms_course_purchases to authenticated;

-- Who may open a course's full content.
create or replace function public.skillfirms_has_course_access(p_user uuid, p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.skillfirms_courses c where c.id = p_course and c.price_cents = 0)
      or exists (select 1 from public.skillfirms_course_purchases p where p.user_id = p_user and p.course_id = p_course and p.payment_status in ('paid', 'credit'))
      or exists (select 1 from public.skillfirms_courses c join public.skillfirms_experts e on e.id = c.expert_id where c.id = p_course and e.profile_id = p_user)
      or exists (select 1 from public.profiles where id = p_user and is_admin)
      or exists (select 1 from public.skillfirms_team_members m join public.skillfirms_team_assignments a on a.company_id = m.company_id
                 and (a.profile_id is null or a.profile_id = m.profile_id) where m.profile_id = p_user and a.course_id = p_course);
$$;
revoke all on function public.skillfirms_has_course_access(uuid, uuid) from public, anon, authenticated;

-- What the lesson rule calls: about the person asking only, safe for anyone
-- (signed-out visitors simply get false).
create or replace function public.skillfirms_can_open_course(p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.skillfirms_has_course_access(auth.uid(), p_course);
$$;
revoke all on function public.skillfirms_can_open_course(uuid) from public;
grant execute on function public.skillfirms_can_open_course(uuid) to anon, authenticated;

-- Lessons: paid courses show lesson 1 to everyone, the rest only with access.
drop policy if exists "ready lessons of published courses are public" on public.skillfirms_lessons;
drop policy if exists "lessons readable with access" on public.skillfirms_lessons;
do $$ begin
  if true then
    create policy "lessons readable with access" on public.skillfirms_lessons for select using (
      status = 'ready' and exists (
        select 1 from public.skillfirms_course_modules m join public.skillfirms_courses c on c.id = m.course_id
        where m.id = skillfirms_lessons.module_id
          and (c.status = 'published' or public.skillfirms_is_admin()
               or c.expert_id in (select id from public.skillfirms_experts where profile_id = (select auth.uid())))
          and (c.price_cents = 0 or m.order_index = 0 or public.skillfirms_can_open_course(c.id))));
  end if;
end $$;

-- Enrolling in (and so taking the checks of) a paid course needs access.
create or replace function public.skillfirms_enrollment_access()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.skillfirms_has_course_access(new.user_id, new.course_id) then
    raise exception 'buy_first: buy this course to take its lessons and checks';
  end if;
  return new;
end;
$$;
drop trigger if exists skillfirms_enrollment_access on public.skillfirms_enrollments;
create trigger skillfirms_enrollment_access before insert on public.skillfirms_enrollments
  for each row execute function public.skillfirms_enrollment_access();

-- Expert lessons are written by the expert, never generated.
create or replace function public.skillfirms_claim_lesson(p_module_id uuid, p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_row public.skillfirms_lessons;
begin
  if exists (select 1 from public.skillfirms_course_modules m join public.skillfirms_courses c on c.id = m.course_id
             where m.id = p_module_id and c.taught_by = 'expert') then
    raise exception 'expert_lesson: written by the instructor';
  end if;
  select * into v_row from public.skillfirms_lessons where module_id = p_module_id for update;
  if v_row.status = 'ready' then return 'ready'; end if;
  if v_row.status = 'generating' and v_row.generated_at > now() - interval '3 minutes' then return 'busy'; end if;
  if (select count(*) from public.skillfirms_lessons where generated_by = p_user and generated_at > now() - interval '24 hours') >= 100 then
    return 'limit';
  end if;
  insert into public.skillfirms_lessons (module_id, status, generated_by, generated_at, error)
  values (p_module_id, 'generating', p_user, now(), null)
  on conflict (module_id) do update set status = 'generating', generated_by = p_user, generated_at = now(), error = null;
  return 'claimed';
end;
$$;

create or replace function public.skillfirms_buy_course(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c public.skillfirms_courses;
  v_open boolean := coalesce((select enabled from public.app_flags where key = 'skillfirms_course_sales'), false);
  v_p public.skillfirms_course_purchases;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select * into v_c from public.skillfirms_courses where id = p_course_id and status = 'published';
  if v_c.id is null then raise exception 'not_found'; end if;
  if v_c.price_cents = 0 then raise exception 'free_course'; end if;
  insert into public.skillfirms_course_purchases (user_id, course_id, price_cents, status)
  values (auth.uid(), v_c.id, v_c.price_cents, case when v_open then 'awaiting_payment' else 'waitlist' end)
  on conflict (user_id, course_id) do update set status = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit')
      then public.skillfirms_course_purchases.status else excluded.status end
  returning * into v_p;
  return to_jsonb(v_p);
end;
$$;
revoke all on function public.skillfirms_buy_course(uuid) from public, anon;
grant execute on function public.skillfirms_buy_course(uuid) to authenticated;

create or replace function public.skillfirms_admin_grant_course(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  update public.skillfirms_course_purchases set status = 'paid', payment_status = 'credit', paid_at = now(),
    instructor_share_cents = round(price_cents * 0.5)
  where id = p_purchase_id and payment_status = 'unpaid';
end;
$$;
revoke all on function public.skillfirms_admin_grant_course(uuid) from public, anon;
grant execute on function public.skillfirms_admin_grant_course(uuid) to authenticated;

-- 3. The studio (experts) -------------------------------------------------------------------------------
create or replace function public._skillfirms_my_course(p_course_id uuid)
returns public.skillfirms_courses language sql stable security definer set search_path = public as $$
  select c.* from public.skillfirms_courses c join public.skillfirms_experts e on e.id = c.expert_id
  where c.id = p_course_id and e.profile_id = auth.uid() and e.active;
$$;
revoke all on function public._skillfirms_my_course(uuid) from public, anon, authenticated;

create or replace function public.skillfirms_studio_courses()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'status', c.status, 'review_state', c.review_state, 'review_note', c.review_note,
      'price_cents', c.price_cents, 'lessons', (select count(*) from public.skillfirms_course_modules m where m.course_id = c.id),
      'learners', c.enrollment_count, 'rating_avg', c.rating_avg, 'rating_count', c.rating_count,
      'sales', (select count(*) from public.skillfirms_course_purchases p where p.course_id = c.id and p.payment_status in ('paid', 'credit')),
      'earned_cents', (select coalesce(sum(instructor_share_cents), 0) from public.skillfirms_course_purchases p where p.course_id = c.id and p.payment_status = 'paid'),
      'updated_at', coalesce(c.submitted_at, c.created_at)) order by c.created_at desc), '[]'::jsonb)
  from public.skillfirms_courses c join public.skillfirms_experts e on e.id = c.expert_id
  where e.profile_id = auth.uid() and e.active and c.taught_by = 'expert';
$$;
revoke all on function public.skillfirms_studio_courses() from public, anon;
grant execute on function public.skillfirms_studio_courses() to authenticated;

-- The full course for editing, answers included (only its own expert).
create or replace function public.skillfirms_studio_course(p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.skillfirms_courses := public._skillfirms_my_course(p_course_id);
begin
  if v_c.id is null then raise exception 'not_yours'; end if;
  return jsonb_build_object(
    'id', v_c.id, 'title', v_c.title, 'description', v_c.description, 'level', v_c.level, 'price_cents', v_c.price_cents,
    'status', v_c.status, 'review_state', v_c.review_state, 'review_note', v_c.review_note, 'slug', v_c.slug,
    'skill_ids', (select coalesce(jsonb_agg(skill_id), '[]') from public.skillfirms_course_skills where course_id = v_c.id),
    'lessons', (select coalesce(jsonb_agg(jsonb_build_object(
        'title', m.title, 'duration_minutes', m.duration_minutes, 'video_url', m.video_url,
        'summary', l.body->>'summary', 'sections', coalesce(l.body->'sections', '[]'), 'key_points', coalesce(l.body->'key_points', '[]'),
        'questions', (select coalesce(jsonb_agg(jsonb_build_object('question', q.question, 'choices', q.choices, 'answer_index', q.correct_index) order by q.order_index), '[]')
                      from public.skillfirms_module_quiz_questions q where q.module_id = m.id)
      ) order by m.order_index), '[]')
      from public.skillfirms_course_modules m left join public.skillfirms_lessons l on l.module_id = m.id where m.course_id = v_c.id));
end;
$$;
revoke all on function public.skillfirms_studio_course(uuid) from public, anon;
grant execute on function public.skillfirms_studio_course(uuid) to authenticated;

-- Save a draft (create when p_course_id is null). Published courses can't be edited here.
create or replace function public.skillfirms_studio_save(p_course_id uuid, p_course jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_expert public.skillfirms_experts := public._skillfirms_my_expert();
  v_c public.skillfirms_courses;
  v_id uuid := p_course_id;
  v_title text := btrim(coalesce(p_course->>'title', ''));
  v_price int := coalesce((p_course->>'price_cents')::int, 0);
  v_lesson jsonb;
  v_q jsonb;
  v_mod uuid;
  v_i int := 0;
  v_j int;
  v_minutes int := 0;
begin
  if v_expert.id is null then raise exception 'experts_only: only approved experts can build courses'; end if;
  if char_length(v_title) < 5 or char_length(v_title) > 120 then raise exception 'title_length: give the course a title of 5-120 characters'; end if;
  if jsonb_array_length(coalesce(p_course->'lessons', '[]')) > 40 then raise exception 'too_many_lessons: up to 40 lessons'; end if;
  if v_id is null then
    insert into public.skillfirms_courses (expert_id, slug, title, description, level, duration_hours, status, taught_by, review_state, price_cents)
    values (v_expert.id,
            trim(both '-' from regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
            v_title, left(p_course->>'description', 4000), coalesce(nullif(p_course->>'level', ''), 'beginner'), 1, 'draft', 'expert', 'draft', v_price)
    returning id into v_id;
  else
    v_c := public._skillfirms_my_course(v_id);
    if v_c.id is null then raise exception 'not_yours'; end if;
    if v_c.status = 'published' then raise exception 'published_locked: a published course can''t be edited here yet'; end if;
    update public.skillfirms_courses set title = v_title, description = left(p_course->>'description', 4000),
      level = coalesce(nullif(p_course->>'level', ''), 'beginner'), price_cents = v_price,
      review_state = case when review_state = 'submitted' then 'draft' else coalesce(review_state, 'draft') end
    where id = v_id;
    delete from public.skillfirms_course_modules where course_id = v_id;
    delete from public.skillfirms_course_skills where course_id = v_id;
  end if;

  insert into public.skillfirms_course_skills (course_id, skill_id, coverage)
  select v_id, s.id, 1.0 from public.skillfirms_skills s
  where s.id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_course->'skill_ids', '[]')) x) limit 6;

  for v_lesson in select * from jsonb_array_elements(coalesce(p_course->'lessons', '[]')) loop
    insert into public.skillfirms_course_modules (course_id, order_index, title, description, duration_minutes, has_quiz, video_url)
    values (v_id, v_i, left(btrim(coalesce(v_lesson->>'title', 'Lesson ' || (v_i + 1))), 200), left(v_lesson->>'summary', 500),
            least(greatest(coalesce((v_lesson->>'duration_minutes')::int, 15), 1), 240), true, nullif(btrim(coalesce(v_lesson->>'video_url', '')), ''))
    returning id into v_mod;
    v_minutes := v_minutes + least(greatest(coalesce((v_lesson->>'duration_minutes')::int, 15), 1), 240);
    insert into public.skillfirms_lessons (module_id, status, body, source, generated_at)
    values (v_mod, 'ready', jsonb_build_object(
      'format', 'expert',
      'summary', coalesce(v_lesson->>'summary', ''),
      'sections', coalesce((select jsonb_agg(jsonb_build_object('heading', left(s->>'heading', 160), 'body', left(s->>'body', 12000)))
                            from jsonb_array_elements(coalesce(v_lesson->'sections', '[]')) s where btrim(coalesce(s->>'body', '')) <> ''), '[]'),
      'key_points', coalesce((select jsonb_agg(left(k #>> '{}', 400)) from jsonb_array_elements(coalesce(v_lesson->'key_points', '[]')) k where btrim(k #>> '{}') <> ''), '[]'),
      'video_url', nullif(btrim(coalesce(v_lesson->>'video_url', '')), '')), 'expert_written', now());
    v_j := 0;
    for v_q in select * from jsonb_array_elements(coalesce(v_lesson->'questions', '[]')) loop
      if btrim(coalesce(v_q->>'question', '')) <> '' and jsonb_array_length(coalesce(v_q->'choices', '[]')) between 2 and 6 then
        insert into public.skillfirms_module_quiz_questions (module_id, order_index, question, choices, correct_index)
        values (v_mod, v_j, left(btrim(v_q->>'question'), 400), v_q->'choices',
                least(greatest(coalesce((v_q->>'answer_index')::int, 0), 0), jsonb_array_length(v_q->'choices') - 1));
        v_j := v_j + 1;
      end if;
    end loop;
    v_i := v_i + 1;
  end loop;
  update public.skillfirms_courses set duration_hours = greatest(round(v_minutes / 60.0, 2), 0.1) where id = v_id;
  return v_id;
end;
$$;
revoke all on function public.skillfirms_studio_save(uuid, jsonb) from public, anon;
grant execute on function public.skillfirms_studio_save(uuid, jsonb) to authenticated;

create or replace function public.skillfirms_studio_submit(p_course_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.skillfirms_courses := public._skillfirms_my_course(p_course_id);
begin
  if v_c.id is null then raise exception 'not_yours'; end if;
  if v_c.status = 'published' then raise exception 'already_published'; end if;
  if (select count(*) from public.skillfirms_course_modules where course_id = v_c.id) < 2 then
    raise exception 'needs_lessons: add at least 2 lessons'; end if;
  if exists (select 1 from public.skillfirms_course_modules m where m.course_id = v_c.id
             and (select count(*) from public.skillfirms_module_quiz_questions q where q.module_id = m.id) < 3) then
    raise exception 'needs_questions: every lesson needs at least 3 graded questions'; end if;
  if exists (select 1 from public.skillfirms_course_modules m left join public.skillfirms_lessons l on l.module_id = m.id
             where m.course_id = v_c.id and m.video_url is null
               and char_length(coalesce((select string_agg(s->>'body', ' ') from jsonb_array_elements(l.body->'sections') s), '')) < 300) then
    raise exception 'needs_content: every lesson needs a video or at least 300 characters of text'; end if;
  if not exists (select 1 from public.skillfirms_course_skills where course_id = v_c.id) then
    raise exception 'needs_skills: pick the skills this course teaches'; end if;
  update public.skillfirms_courses set review_state = 'submitted', submitted_at = now(), review_note = null where id = v_c.id;
end;
$$;
revoke all on function public.skillfirms_studio_submit(uuid) from public, anon;
grant execute on function public.skillfirms_studio_submit(uuid) to authenticated;

-- 4. Admin review ------------------------------------------------------------------------------------------
create or replace function public.skillfirms_admin_course_reviews()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.skillfirms_is_admin() then '[]'::jsonb else coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'description', c.description, 'price_cents', c.price_cents,
      'review_state', c.review_state, 'submitted_at', c.submitted_at, 'expert', e.display_name,
      'lessons', (select count(*) from public.skillfirms_course_modules m where m.course_id = c.id),
      'videos', (select count(*) from public.skillfirms_course_modules m where m.course_id = c.id and m.video_url is not null)
    ) order by c.submitted_at), '[]'::jsonb) end
  from public.skillfirms_courses c join public.skillfirms_experts e on e.id = c.expert_id
  where c.taught_by = 'expert' and c.review_state = 'submitted';
$$;
revoke all on function public.skillfirms_admin_course_reviews() from public, anon;
grant execute on function public.skillfirms_admin_course_reviews() to authenticated;

create or replace function public.skillfirms_admin_review_course(p_course_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  if p_decision = 'approve' then
    update public.skillfirms_courses set status = 'published', review_state = 'approved', review_note = p_note, published_at = now()
    where id = p_course_id and review_state = 'submitted' and taught_by = 'expert';
  elsif p_decision = 'changes' then
    update public.skillfirms_courses set review_state = 'changes_requested', review_note = coalesce(p_note, 'Please make some changes')
    where id = p_course_id and review_state = 'submitted';
  else raise exception 'unknown decision'; end if;
  if not found then raise exception 'not_waiting_for_review'; end if;
end;
$$;
revoke all on function public.skillfirms_admin_review_course(uuid, text, text) from public, anon;
grant execute on function public.skillfirms_admin_review_course(uuid, text, text) to authenticated;

create or replace function public.skillfirms_admin_course_purchases()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.skillfirms_is_admin() then '[]'::jsonb else coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'course', c.title, 'buyer', pr.display_name, 'price_cents', p.price_cents, 'status', p.status,
      'payment_status', p.payment_status, 'created_at', p.created_at) order by p.created_at desc), '[]'::jsonb) end
  from public.skillfirms_course_purchases p join public.skillfirms_courses c on c.id = p.course_id join public.profiles pr on pr.id = p.user_id;
$$;
revoke all on function public.skillfirms_admin_course_purchases() from public, anon;
grant execute on function public.skillfirms_admin_course_purchases() to authenticated;

-- 5. Video uploads (short clips; long videos go on YouTube/Vimeo/Loom) -------------------------------------
do $$ begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('course-videos', 'course-videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
  on conflict (id) do nothing;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'experts upload course videos') then
    execute $p$create policy "experts upload course videos" on storage.objects for insert to authenticated
      with check (bucket_id = 'course-videos' and (storage.foldername(name))[1] = (select auth.uid())::text
                  and exists (select 1 from public.skillfirms_experts e where e.profile_id = (select auth.uid()) and e.active))$p$;
  end if;
end $$;
