-- Founding tutors: the first 20 approved tutors keep 85% (not 70%) of
-- marketplace sales for their first 6 months. Their own-link sales stay 97%.
-- Set once, when a tutor is approved; the share is locked into each sale.

alter table public.skillfirms_experts add column if not exists founding_until timestamptz;

create or replace function public._skillfirms_mark_founding_tutor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is not null and new.approved_at is not null and new.founding_until is null
     and (tg_op = 'INSERT' or old.approved_at is null)
     and (select count(*) from public.skillfirms_experts where founding_until is not null and id <> new.id) < 20 then
    new.founding_until := new.approved_at + interval '6 months';
  end if;
  return new;
end;
$$;
revoke all on function public._skillfirms_mark_founding_tutor() from public, anon, authenticated;
drop trigger if exists skillfirms_experts_founding on public.skillfirms_experts;
create trigger skillfirms_experts_founding before insert or update of approved_at on public.skillfirms_experts
  for each row execute function public._skillfirms_mark_founding_tutor();

-- The share for a sale of this course, by channel and the tutor's founding status.
create or replace function public.skillfirms_expert_share_for(p_course_id uuid, p_channel text)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when p_channel = 'expert_link' then 0.97
    when exists (select 1 from public.skillfirms_courses c join public.skillfirms_experts e on e.id = c.expert_id
                 where c.id = p_course_id and e.founding_until > now()) then 0.85
    else 0.70 end;
$$;
revoke all on function public.skillfirms_expert_share_for(uuid, text) from public, anon, authenticated;

create or replace function public.skillfirms_admin_grant_course(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  update public.skillfirms_course_purchases set status = 'paid', payment_status = 'credit', paid_at = now(),
    instructor_share_cents = round(price_cents * public.skillfirms_expert_share_for(course_id, channel))
  where id = p_purchase_id and payment_status = 'unpaid';
end;
$$;
revoke all on function public.skillfirms_admin_grant_course(uuid) from public, anon;
grant execute on function public.skillfirms_admin_grant_course(uuid) to authenticated;

-- For the Experts page and the tutor's studio.
create or replace function public.skillfirms_founding_tutors()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'spots_left', greatest(0, 20 - (select count(*) from public.skillfirms_experts where founding_until is not null)),
    'mine_until', (select founding_until from public.skillfirms_experts where profile_id = auth.uid() and founding_until > now()));
$$;
revoke all on function public.skillfirms_founding_tutors() from public;
grant execute on function public.skillfirms_founding_tutors() to anon, authenticated;
