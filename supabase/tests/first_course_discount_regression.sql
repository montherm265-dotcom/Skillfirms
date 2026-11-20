-- 0037: 20% off the first paid course, once per person.
begin;
create temp table k (role text, id uuid);
grant select on k to authenticated;
insert into k select 'u', id from public.profiles order by created_at desc limit 1;
-- two published paid courses
update public.skillfirms_courses set price_cents = 5000, first_course_discount = true
  where id in (select id from public.skillfirms_courses where status = 'published' order by id limit 2);
insert into k select 'c1', id from public.skillfirms_courses where status = 'published' order by id limit 1;
insert into k select 'c2', id from public.skillfirms_courses where status = 'published' order by id offset 1 limit 1;
delete from public.skillfirms_course_purchases where user_id = (select id from k where role = 'u');

set role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from k where role = 'u'), true);
do $$
declare p jsonb;
begin
  if not public.skillfirms_first_course_offer() then raise exception 'FAIL: new learner has no offer'; end if;
  p := public.skillfirms_buy_course_v2((select id from k where role = 'c1'));
  if (p->>'price_cents')::int <> 4000 or p->>'discount_kind' <> 'first_course' then raise exception 'FAIL: first buy %', p; end if;
  p := public.skillfirms_buy_course_v2((select id from k where role = 'c1'));
  if (p->>'price_cents')::int <> 4000 then raise exception 'FAIL: re-buy lost the offer %', p; end if;
  raise notice 'PASS: first course is 20%% off, and stays so when you press buy again';
  p := public.skillfirms_buy_course_v2((select id from k where role = 'c2'));
  if (p->>'price_cents')::int <> 5000 or p->>'discount_kind' is not null then raise exception 'FAIL: second course discounted %', p; end if;
  raise notice 'PASS: only one course gets it';
end $$;
reset role;
-- once a purchase is paid, the offer is gone for good
update public.skillfirms_course_purchases set payment_status = 'paid', status = 'paid' where user_id = (select id from k where role = 'u') and course_id = (select id from k where role = 'c2');
set role authenticated;
do $$ begin
  if public.skillfirms_first_course_offer((select id from k where role = 'c1')) then raise exception 'FAIL: offer survives a paid purchase'; end if;
  if (public.skillfirms_buy_course_v2((select id from k where role = 'c1'))->>'price_cents')::int <> 5000 then raise exception 'FAIL: still discounted after paying'; end if;
  raise notice 'PASS: after a paid purchase, full price';
end $$;
reset role;
-- tutor switched it off
delete from public.skillfirms_course_purchases where user_id = (select id from k where role = 'u');
update public.skillfirms_courses set first_course_discount = false where id = (select id from k where role = 'c1');
set role authenticated;
do $$ begin
  if (public.skillfirms_buy_course_v2((select id from k where role = 'c1'))->>'price_cents')::int <> 5000 then raise exception 'FAIL: opt-out ignored'; end if;
  raise notice 'PASS: a tutor can switch it off';
end $$;
reset role;
-- tutor share is on what was paid
select case when round(4000 * public.skillfirms_expert_share('marketplace')) = 2800 then 'PASS: tutor gets 70% of the $40 paid' else 'FAIL: share' end;
rollback;
