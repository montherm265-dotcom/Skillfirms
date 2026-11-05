-- 0033: Free courses are the AI-made basics. A course taught by an expert is
-- always paid ($9 to $199, set by the expert). Enforced here, whatever path
-- saves the course. Safe to run more than once.

create or replace function public._skillfirms_expert_course_is_paid()
returns trigger language plpgsql as $$
begin
  if new.taught_by = 'expert' and coalesce(new.price_cents, 0) = 0 then
    raise exception 'expert_courses_are_paid: expert courses need a price from $9 to $199';
  end if;
  return new;
end;
$$;

create or replace trigger skillfirms_expert_course_is_paid
before insert or update of price_cents, taught_by on public.skillfirms_courses
for each row execute function public._skillfirms_expert_course_is_paid();

create or replace function public.skillfirms_studio_set_price(p_course_id uuid, p_price_cents integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.skillfirms_courses := public._skillfirms_my_course(p_course_id);
begin
  if v_c.id is null then raise exception 'not_yours'; end if;
  if p_price_cents is null or p_price_cents not between 900 and 19900 then
    raise exception 'bad_price: $9 to $199';
  end if;
  update public.skillfirms_courses set price_cents = p_price_cents where id = v_c.id;
end;
$$;
revoke all on function public.skillfirms_studio_set_price(uuid, integer) from public, anon;
grant execute on function public.skillfirms_studio_set_price(uuid, integer) to authenticated;

select true as ok;
