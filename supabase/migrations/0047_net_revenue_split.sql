-- Tutor earnings are a share of NET REVENUE, shown per sale.
--
--   Net revenue = gross price paid
--                 - taxes (VAT / sales tax)
--                 - currency conversion fees
--                 - the platform fee: 3% administrative/processing fee on
--                   web sales, or the app store's commission (Apple /
--                   Google) on in-app sales
--                 - refunds and chargebacks
--
--   Tutor payout = net revenue x their share:
--     60%  when Skillfirms brings the learner
--     85%  founding tutors, first 6 months
--     100% through the tutor's own link (Skillfirms keeps only the 3% fee)
--
-- Every sale stores each line, so the tutor sees the exact math.
alter table public.skillfirms_course_purchases
  add column if not exists sale_channel text not null default 'web' check (sale_channel in ('web', 'app_store', 'play_store')),
  add column if not exists gross_cents int,
  add column if not exists tax_cents int not null default 0,
  add column if not exists fx_fee_cents int not null default 0,
  add column if not exists platform_fee_cents int not null default 0,
  add column if not exists refund_cents int not null default 0,
  add column if not exists net_cents int,
  add column if not exists share_pct numeric(5,4);

create or replace function public.skillfirms_expert_share_for(p_course_id uuid, p_channel text)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when p_channel = 'expert_link' then 1.00
    when exists (select 1 from public.skillfirms_courses c join public.skillfirms_experts e on e.id = c.expert_id
                 where c.id = p_course_id and e.founding_until > now()) then 0.85
    else 0.60 end;
$$;
create or replace function public.skillfirms_expert_share(p_channel text)
returns numeric language sql immutable set search_path = public, extensions as $$
  select case when p_channel = 'expert_link' then 1.00 else 0.60 end;
$$;

-- Records a sale's numbers and the tutor's payout. Called when a payment is
-- confirmed (by the payment webhook with the real tax and fee amounts, or by
-- an admin grant until card payments are on).
create or replace function public._skillfirms_settle_sale(p_purchase uuid, p_gross int, p_tax int, p_fx_fee int, p_store_fee int)
returns void language plpgsql security definer set search_path = public as $$
declare p public.skillfirms_course_purchases; v_fee int; v_net int; v_share numeric;
begin
  select * into p from public.skillfirms_course_purchases where id = p_purchase for update;
  if p.id is null then return; end if;
  v_fee := case when p.sale_channel = 'web' then round(0.03 * greatest(p_gross - coalesce(p_tax, 0), 0)) else coalesce(p_store_fee, 0) end;
  v_net := greatest(p_gross - coalesce(p_tax, 0) - coalesce(p_fx_fee, 0) - v_fee - p.refund_cents, 0);
  v_share := public.skillfirms_expert_share_for(p.course_id, p.channel);
  update public.skillfirms_course_purchases set gross_cents = p_gross, tax_cents = coalesce(p_tax, 0), fx_fee_cents = coalesce(p_fx_fee, 0),
    platform_fee_cents = v_fee, net_cents = v_net, share_pct = v_share, instructor_share_cents = round(v_net * v_share)
  where id = p.id;
end;
$$;
revoke all on function public._skillfirms_settle_sale(uuid, int, int, int, int) from public, anon, authenticated;

-- A refund or chargeback comes off net revenue (and so off the payout).
create or replace function public._skillfirms_record_refund(p_purchase uuid, p_refund_cents int)
returns void language plpgsql security definer set search_path = public as $$
declare p public.skillfirms_course_purchases; v_net int;
begin
  select * into p from public.skillfirms_course_purchases where id = p_purchase for update;
  if p.id is null or p.gross_cents is null then return; end if;
  v_net := greatest(p.gross_cents - p.tax_cents - p.fx_fee_cents - p.platform_fee_cents - p_refund_cents, 0);
  update public.skillfirms_course_purchases set refund_cents = p_refund_cents, net_cents = v_net,
    instructor_share_cents = round(v_net * coalesce(p.share_pct, 0)),
    payment_status = case when p_refund_cents >= p.gross_cents then 'refunded' else payment_status end,
    status = case when p_refund_cents >= p.gross_cents then 'refunded' else status end
  where id = p.id;
end;
$$;
revoke all on function public._skillfirms_record_refund(uuid, int) from public, anon, authenticated;

create or replace function public.skillfirms_admin_grant_course(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.skillfirms_is_admin() then raise exception 'admins only'; end if;
  update public.skillfirms_course_purchases set status = 'paid', payment_status = 'credit', paid_at = now()
  where id = p_purchase_id and payment_status = 'unpaid';
  if found then
    perform public._skillfirms_settle_sale(p_purchase_id, (select price_cents from public.skillfirms_course_purchases where id = p_purchase_id), 0, 0, 0);
  end if;
end;
$$;

-- The tutor's per-sale breakdown (their own courses only).
create or replace function public.skillfirms_my_sales(p_limit int default 50)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'at' desc), '[]') from (
    select jsonb_build_object('id', p.id, 'course', c.title, 'at', p.paid_at, 'channel', p.channel, 'sale_channel', p.sale_channel,
      'gross_cents', p.gross_cents, 'tax_cents', p.tax_cents, 'fx_fee_cents', p.fx_fee_cents, 'platform_fee_cents', p.platform_fee_cents,
      'refund_cents', p.refund_cents, 'net_cents', p.net_cents, 'share_pct', p.share_pct, 'payout_cents', p.instructor_share_cents,
      'refunded', p.payment_status = 'refunded') x
    from public.skillfirms_course_purchases p
    join public.skillfirms_courses c on c.id = p.course_id
    join public.skillfirms_experts e on e.id = c.expert_id and e.profile_id = auth.uid()
    where p.paid_at is not null and p.payment_status in ('paid', 'credit', 'refunded')
    order by p.paid_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) t;
$$;
revoke all on function public.skillfirms_my_sales(int) from public, anon;
grant execute on function public.skillfirms_my_sales(int) to authenticated;
