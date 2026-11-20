-- Public instructor page: only public fields (never payout share or ref code),
-- their published courses, learners taught and rating.
create or replace function public.skillfirms_instructor(p_expert_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when e.id is null then null else jsonb_build_object(
    'id', e.id, 'display_name', e.display_name, 'headline', e.headline, 'bio', e.bio, 'credentials', e.credentials,
    'since', coalesce(e.approved_at, e.created_at),
    'learners', (select count(distinct en.user_id) from public.skillfirms_enrollments en join public.skillfirms_courses c on c.id = en.course_id
                 where c.expert_id = e.id and c.status = 'published'),
    'reviews', (select count(*) from public.skillfirms_course_reviews r join public.skillfirms_courses c on c.id = r.course_id where c.expert_id = e.id and c.status = 'published'),
    'rating', (select round(avg(r.rating)::numeric, 1) from public.skillfirms_course_reviews r join public.skillfirms_courses c on c.id = r.course_id where c.expert_id = e.id and c.status = 'published'),
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'title', c.title, 'description', left(c.description, 240),
                  'level', c.level, 'duration_hours', c.duration_hours, 'price_cents', c.price_cents, 'rating_avg', c.rating_avg, 'rating_count', c.rating_count,
                  'learners', (select count(*) from public.skillfirms_enrollments en where en.course_id = c.id)) order by c.published_at desc nulls last), '[]')
                from public.skillfirms_courses c where c.expert_id = e.id and c.status = 'published')
  ) end
  from (select 1) one left join public.skillfirms_experts e on e.id = p_expert_id and coalesce(e.active, true) and e.profile_id is not null;
$$;
revoke all on function public.skillfirms_instructor(uuid) from public;
grant execute on function public.skillfirms_instructor(uuid) to anon, authenticated;
