-- Web course sales: the processing fee is 3% + $0.30 (covers the card fee on
-- every sale). Through a tutor's own link the tutor keeps 95% of Net Revenue
-- (was 100%), so those sales never cost Skillfirms money.
select public._edit_fn('public._skillfirms_settle_sale(uuid,integer,integer,integer,integer)'::regprocedure, array[array[
  $a$round(0.03 * greatest(p_gross - coalesce(p_tax, 0), 0))$a$,
  $b$round(0.03 * greatest(p_gross - coalesce(p_tax, 0), 0)) + 30$b$]]);
create or replace function public.skillfirms_expert_share_for(p_course_id uuid, p_channel text)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when p_channel = 'expert_link' then 0.95
    when exists (select 1 from public.skillfirms_courses c join public.skillfirms_experts e on e.id = c.expert_id
                 where c.id = p_course_id and e.founding_until > now()) then 0.85
    else 0.60 end;
$$;
create or replace function public.skillfirms_expert_share(p_channel text)
returns numeric language sql immutable set search_path = public, extensions as $$
  select case when p_channel = 'expert_link' then 0.95 else 0.60 end;
$$;
