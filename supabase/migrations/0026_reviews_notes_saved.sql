-- Course reviews, lesson notes, and saved courses.
--
-- 1. Reviews: only someone who has passed at least one lesson's graded
--    check can rate a course (1–5 stars + optional text), one review per
--    person per course, editable. The course's rating_avg/rating_count are
--    recomputed from real reviews. Each review shows how many lessons the
--    reviewer actually passed, so readers can weigh it.
-- 2. Notes: private notes per lesson, only ever visible to their writer.
-- 3. Saved: a personal "save for later" list.

-- 1. Reviews -------------------------------------------------------------------------------
create table if not exists public.skillfirms_course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create index if not exists skillfirms_course_reviews_course_idx on public.skillfirms_course_reviews(course_id, created_at desc);
alter table public.skillfirms_course_reviews enable row level security;
-- No direct table access: reads and writes go through the functions below.
revoke all on public.skillfirms_course_reviews from anon, authenticated;

create or replace function public.skillfirms_lessons_passed(p_user uuid, p_course uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.skillfirms_module_progress mp
  join public.skillfirms_enrollments e on e.id = mp.enrollment_id
  where e.user_id = p_user and e.course_id = p_course and mp.completed_at is not null;
$$;
revoke all on function public.skillfirms_lessons_passed(uuid, uuid) from public, anon, authenticated;

create or replace function public.skillfirms_refresh_course_rating(p_course uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.skillfirms_courses c set
    rating_avg = (select round(avg(rating)::numeric, 2) from public.skillfirms_course_reviews where course_id = p_course),
    rating_count = (select count(*) from public.skillfirms_course_reviews where course_id = p_course)
  where c.id = p_course;
$$;
revoke all on function public.skillfirms_refresh_course_rating(uuid) from public, anon, authenticated;

create or replace function public.skillfirms_review_course(p_course_id uuid, p_rating integer, p_body text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_body text := nullif(trim(coalesce(p_body, '')), '');
begin
  if v_user is null then raise exception 'sign_in_required'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'rating_1_to_5'; end if;
  if char_length(coalesce(v_body, '')) > 2000 then raise exception 'review_too_long'; end if;
  if public.skillfirms_lessons_passed(v_user, p_course_id) < 1 then
    raise exception 'pass_a_lesson_first: pass at least one lesson''s check before rating this course';
  end if;
  insert into public.skillfirms_course_reviews (course_id, user_id, rating, body)
  values (p_course_id, v_user, p_rating, v_body)
  on conflict (course_id, user_id) do update set rating = excluded.rating, body = excluded.body, updated_at = now();
  perform public.skillfirms_refresh_course_rating(p_course_id);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.skillfirms_review_course(uuid, integer, text) from public, anon;
grant execute on function public.skillfirms_review_course(uuid, integer, text) to authenticated;

create or replace function public.skillfirms_remove_my_review(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  delete from public.skillfirms_course_reviews where course_id = p_course_id and user_id = auth.uid();
  perform public.skillfirms_refresh_course_rating(p_course_id);
end;
$$;
revoke all on function public.skillfirms_remove_my_review(uuid) from public, anon;
grant execute on function public.skillfirms_remove_my_review(uuid) to authenticated;

-- Public list: first name + last initial only, and how far the reviewer got.
create or replace function public.skillfirms_course_reviews_for(p_course_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'avg', (select round(avg(rating)::numeric, 1) from public.skillfirms_course_reviews where course_id = p_course_id),
    'count', (select count(*) from public.skillfirms_course_reviews where course_id = p_course_id),
    'stars', (select coalesce(jsonb_object_agg(s, n), '{}'::jsonb) from (
       select rating as s, count(*) as n from public.skillfirms_course_reviews where course_id = p_course_id group by rating) t),
    'lessons', (select count(*) from public.skillfirms_course_modules where course_id = p_course_id),
    'mine', (select jsonb_build_object('rating', r.rating, 'body', r.body) from public.skillfirms_course_reviews r
             where r.course_id = p_course_id and r.user_id = auth.uid()),
    'can_review', auth.uid() is not null and public.skillfirms_lessons_passed(auth.uid(), p_course_id) >= 1,
    'reviews', coalesce((select jsonb_agg(x order by x.created_at desc) from (
       select r.rating, r.body, r.created_at,
         coalesce(nullif(split_part(trim(p.display_name), ' ', 1), ''), 'A learner')
           || case when split_part(trim(p.display_name), ' ', 2) <> '' then ' ' || left(split_part(trim(p.display_name), ' ', 2), 1) || '.' else '' end as name,
         public.skillfirms_lessons_passed(r.user_id, r.course_id) as passed
       from public.skillfirms_course_reviews r
       left join public.profiles p on p.id = r.user_id
       where r.course_id = p_course_id
       order by r.created_at desc limit 30) x), '[]'::jsonb)
  );
$$;
revoke all on function public.skillfirms_course_reviews_for(uuid) from public;
grant execute on function public.skillfirms_course_reviews_for(uuid) to anon, authenticated;

-- 2. Notes ----------------------------------------------------------------------------------
create table if not exists public.skillfirms_lesson_notes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null references public.skillfirms_course_modules(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id)
);
alter table public.skillfirms_lesson_notes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'skillfirms_lesson_notes' and policyname = 'notes are private to their writer') then
    create policy "notes are private to their writer" on public.skillfirms_lesson_notes for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.skillfirms_lesson_notes from anon;
grant select, insert, update, delete on public.skillfirms_lesson_notes to authenticated;

-- 3. Saved courses ----------------------------------------------------------------------------
create table if not exists public.skillfirms_saved_courses (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.skillfirms_courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table public.skillfirms_saved_courses enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'skillfirms_saved_courses' and policyname = 'saved list is private') then
    create policy "saved list is private" on public.skillfirms_saved_courses for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.skillfirms_saved_courses from anon;
grant select, insert, delete on public.skillfirms_saved_courses to authenticated;

-- 4. Honest course length ---------------------------------------------------------------------
-- duration_hours held early estimates (4–14 h). Set it to the real time:
-- each lesson's reading time plus a 15-minute exercise per lesson.
update public.skillfirms_courses c set duration_hours = round(t.minutes / 60.0, 2)
from (select course_id, sum(coalesce(duration_minutes, 0)) + count(*) * 15 as minutes
      from public.skillfirms_course_modules group by course_id) t
where t.course_id = c.id;
