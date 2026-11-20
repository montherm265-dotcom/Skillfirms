-- 20% off a learner's first paid course. No code to type: it shows on the
-- course page and is applied at checkout. Once per person: it sits on one
-- purchase at a time and is gone once any purchase is paid. The tutor's
-- share is worked out on what the learner actually pays (as before), so
-- both sides give up a little and Skillfirms never goes below zero.
-- Tutors can switch it off per course; it's on by default.
alter table public.skillfirms_courses add column if not exists first_course_discount boolean not null default true;
alter table public.skillfirms_course_purchases add column if not exists discount_kind text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'skillfirms_course_purchases_discount_check') then
    alter table public.skillfirms_course_purchases add constraint skillfirms_course_purchases_discount_check check (discount_kind is null or discount_kind = 'first_course');
  end if;
end $$;

-- Can this person (or a guest) still get the first-course 20%?
-- p_course_id: the course they're looking at (a row already holding the
-- offer for this same course still counts as theirs).
create or replace function public.skillfirms_first_course_offer(p_course_id uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null or (
    not exists (select 1 from public.skillfirms_course_purchases p where p.user_id = auth.uid() and p.payment_status in ('paid', 'credit'))
    and not exists (select 1 from public.skillfirms_course_purchases p where p.user_id = auth.uid() and p.discount_kind = 'first_course'
                    and p.course_id is distinct from p_course_id)
  );
$$;
revoke all on function public.skillfirms_first_course_offer(uuid) from public;
grant execute on function public.skillfirms_first_course_offer(uuid) to anon, authenticated;

create or replace function public.skillfirms_buy_course_v2(p_course_id uuid, p_ref text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c public.skillfirms_courses;
  v_open boolean := coalesce((select enabled from public.app_flags where key = 'skillfirms_course_sales'), false);
  v_channel text := 'marketplace';
  v_p public.skillfirms_course_purchases;
  v_disc boolean;
  v_price integer;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select * into v_c from public.skillfirms_courses where id = p_course_id and status = 'published';
  if v_c.id is null then raise exception 'not_found'; end if;
  if v_c.price_cents = 0 then raise exception 'free_course'; end if;
  if p_ref is not null and exists (select 1 from public.skillfirms_experts e where e.id = v_c.expert_id and e.ref_code = p_ref) then
    v_channel := 'expert_link';
  end if;
  -- Serialise this person's buys so two tabs can't both take the offer.
  perform pg_advisory_xact_lock(hashtext('sf_first_course:' || auth.uid()::text));
  v_disc := v_c.first_course_discount and public.skillfirms_first_course_offer(v_c.id);
  v_price := case when v_disc then round(v_c.price_cents * 0.8)::int else v_c.price_cents end;
  insert into public.skillfirms_course_purchases (user_id, course_id, price_cents, list_price_cents, status, channel, discount_kind)
  values (auth.uid(), v_c.id, v_price, v_c.price_cents, case when v_open then 'awaiting_payment' else 'waitlist' end, v_channel,
          case when v_disc then 'first_course' end)
  on conflict (user_id, course_id) do update set
    status = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit') then public.skillfirms_course_purchases.status else excluded.status end,
    price_cents = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit') then public.skillfirms_course_purchases.price_cents else excluded.price_cents end,
    list_price_cents = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit') then public.skillfirms_course_purchases.list_price_cents else excluded.list_price_cents end,
    discount_kind = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit') then public.skillfirms_course_purchases.discount_kind else excluded.discount_kind end,
    channel = case when public.skillfirms_course_purchases.payment_status in ('paid', 'credit') then public.skillfirms_course_purchases.channel
                   when excluded.channel = 'expert_link' then 'expert_link' else public.skillfirms_course_purchases.channel end
  returning * into v_p;
  return to_jsonb(v_p);
end;
$$;
revoke all on function public.skillfirms_buy_course_v2(uuid, text) from public, anon;
grant execute on function public.skillfirms_buy_course_v2(uuid, text) to authenticated;

-- Tutors switch the offer on or off for their course.
create or replace function public.skillfirms_studio_set_first_discount(p_course_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.skillfirms_courses := public._skillfirms_my_course(p_course_id);
begin
  if v_c.id is null then raise exception 'not_yours'; end if;
  update public.skillfirms_courses set first_course_discount = coalesce(p_on, true) where id = v_c.id;
end;
$$;
revoke all on function public.skillfirms_studio_set_first_discount(uuid, boolean) from public, anon;
grant execute on function public.skillfirms_studio_set_first_discount(uuid, boolean) to authenticated;
