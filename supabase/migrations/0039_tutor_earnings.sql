-- What a tutor has earned, what's held for the 14-day refund window, what's
-- ready to pay out, and who is waiting to buy until card payments open.
-- Read-only: nothing here moves money.
create or replace function public.skillfirms_my_earnings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.skillfirms_experts; v jsonb;
begin
  select * into e from public.skillfirms_experts where profile_id = auth.uid();
  if e.id is null then return null; end if;
  with lines as (
    select 'course' as kind, c.title as what, p.paid_at as at, p.instructor_share_cents as cents, p.payment_status = 'refunded' as refunded
    from public.skillfirms_course_purchases p join public.skillfirms_courses c on c.id = p.course_id
    where c.expert_id = e.id and p.payment_status in ('paid', 'refunded') and p.paid_at is not null
    union all
    select 'interview', (select string_agg(k.label, ', ') from public.capabilities k where k.id = any (i.capability_ids)), i.completed_at, i.tutor_share_cents, i.payment_status = 'refunded'
    from public.skill_interviews i where i.expert_id = e.id and i.status = 'completed' and i.payment_status in ('paid', 'refunded')
    union all
    select 'review', 'Expert review', o.paid_at, o.expert_payout_cents, false
    from public.skillfirms_review_orders o where o.expert_id = e.id and o.status = 'reviewed' and o.expert_payout_cents is not null and o.paid_at is not null
  )
  select jsonb_build_object(
    'founding_until', e.founding_until,
    'earned_cents', coalesce(sum(cents) filter (where not refunded), 0),
    'held_cents', coalesce(sum(cents) filter (where not refunded and at > now() - interval '14 days'), 0),
    'ready_cents', coalesce(sum(cents) filter (where not refunded and at <= now() - interval '14 days'), 0),
    'refunded_cents', coalesce(sum(cents) filter (where refunded), 0),
    'by_month', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'cents', s) order by m)
       from (select to_char(date_trunc('month', at), 'YYYY-MM') m, sum(cents) s from lines where not refunded and at > now() - interval '6 months' group by 1) t), '[]'),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'what', what, 'at', at, 'cents', cents, 'refunded', refunded) order by at desc)
       from (select * from lines order by at desc limit 20) r), '[]'))
  into v from lines;
  return v || jsonb_build_object(
    'waiting_buyers', (select count(*) from public.skillfirms_course_purchases p join public.skillfirms_courses c on c.id = p.course_id
                       where c.expert_id = e.id and p.status = 'waitlist'),
    'waiting_cents', (select coalesce(sum(round(p.price_cents * public.skillfirms_expert_share_for(c.id, 'marketplace'))), 0)
                      from public.skillfirms_course_purchases p join public.skillfirms_courses c on c.id = p.course_id
                      where c.expert_id = e.id and p.status = 'waitlist'),
    'interviews_waiting', (select count(*) from public.skill_interviews i where i.expert_id = e.id and i.status in ('requested', 'scheduled')),
    'payments_live', coalesce((select enabled from public.app_flags where key = 'skillfirms_course_sales'), false));
end;
$$;
revoke all on function public.skillfirms_my_earnings() from public, anon;
grant execute on function public.skillfirms_my_earnings() to authenticated;
