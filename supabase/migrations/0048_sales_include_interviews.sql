-- The tutor's per-sale breakdown also lists skill interviews (75% of net
-- revenue, Talfirms migration 0288), with the same lines as course sales.
create or replace function public.skillfirms_my_sales(p_limit int default 50)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'at' desc), '[]') from (
    (select jsonb_build_object('id', p.id, 'kind', 'course', 'course', c.title, 'at', p.paid_at, 'channel', p.channel, 'sale_channel', p.sale_channel,
      'gross_cents', p.gross_cents, 'tax_cents', p.tax_cents, 'fx_fee_cents', p.fx_fee_cents, 'platform_fee_cents', p.platform_fee_cents,
      'refund_cents', p.refund_cents, 'net_cents', p.net_cents, 'share_pct', p.share_pct, 'payout_cents', p.instructor_share_cents,
      'refunded', p.payment_status = 'refunded') x
    from public.skillfirms_course_purchases p
    join public.skillfirms_courses c on c.id = p.course_id
    join public.skillfirms_experts e on e.id = c.expert_id and e.profile_id = auth.uid()
    where p.paid_at is not null and p.payment_status in ('paid', 'credit', 'refunded')
    order by p.paid_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200))
    union all
    (select jsonb_build_object('id', i.id, 'kind', 'interview', 'course', 'Skill interview: ' || coalesce((select string_agg(k.label, ', ') from public.capabilities k where k.id = any(i.capability_ids)), ''),
      'at', i.completed_at, 'channel', 'marketplace', 'sale_channel', i.sale_channel, 'included', i.payment_status = 'included',
      'gross_cents', i.gross_cents, 'tax_cents', i.tax_cents, 'fx_fee_cents', i.fx_fee_cents, 'platform_fee_cents', i.platform_fee_cents,
      'refund_cents', i.refund_cents, 'net_cents', i.net_cents, 'share_pct', i.share_pct, 'payout_cents', i.tutor_share_cents,
      'refunded', i.payment_status = 'refunded')
    from public.skill_interviews i
    join public.skillfirms_experts e on e.id = i.expert_id and e.profile_id = auth.uid()
    where i.status = 'completed' and i.completed_at is not null and i.payment_status in ('paid', 'included', 'refunded')
    order by i.completed_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200))) t;
$$;
