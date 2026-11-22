-- Tutors keep 60% (was 70%) when Skillfirms finds the learner. Through the
-- tutor's own link stays 97%; founding tutors keep 85% for their first 6
-- months, as promised. Sales already made keep the share they were made at
-- (earnings are recorded per sale).
create or replace function public.skillfirms_expert_share(p_channel text)
returns numeric language sql immutable set search_path = public, extensions as $$
  select case when p_channel = 'expert_link' then 0.97 else 0.60 end;
$$;

create or replace function public.skillfirms_expert_share_for(p_course_id uuid, p_channel text)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when p_channel = 'expert_link' then 0.97
    when exists (select 1 from public.skillfirms_courses c join public.skillfirms_experts e on e.id = c.expert_id
                 where c.id = p_course_id and e.founding_until > now()) then 0.85
    else 0.60 end;
$$;
