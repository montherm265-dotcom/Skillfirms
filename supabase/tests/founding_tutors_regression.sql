begin;
create temp table k (role text, id uuid);
insert into k select 'p', id from public.profiles order by created_at limit 1;
update public.skillfirms_experts set founding_until = null;
insert into public.skillfirms_experts (profile_id, display_name, headline, active) values ((select id from k), 'T38', 'x', true) returning id \gset e_
do $$ begin
  if (select founding_until from public.skillfirms_experts where id = (select max(id::text)::uuid from public.skillfirms_experts where display_name = 'T38')) is not null then raise exception 'FAIL: founding before approval'; end if;
end $$;
update public.skillfirms_experts set approved_at = now() where display_name = 'T38';
insert into public.skillfirms_courses (expert_id, slug, title, level, status, taught_by, price_cents)
  values (:'e_id', 't38', 'T38 course', 'beginner', 'published', 'expert', 10000) returning id \gset c_
do $$ declare c uuid := (select id from public.skillfirms_courses where slug = 't38'); begin
  if (select founding_until from public.skillfirms_experts where display_name = 'T38') < now() + interval '5 months' then raise exception 'FAIL: not founding'; end if;
  if public.skillfirms_expert_share_for(c, 'marketplace') <> 0.85 or public.skillfirms_expert_share_for(c, 'expert_link') <> 0.97 then raise exception 'FAIL: share'; end if;
  update public.skillfirms_experts set founding_until = now() - interval '1 day' where display_name = 'T38';
  if public.skillfirms_expert_share_for(c, 'marketplace') <> 0.70 then raise exception 'FAIL: after 6 months'; end if;
  raise notice 'PASS: approved tutor is founding (85%%), 97%% own link, back to 70%% after';
end $$;
-- the 21st approved tutor is not founding
update public.skillfirms_experts set founding_until = now() + interval '1 month' where display_name = 'T38';
insert into public.skillfirms_experts (profile_id, display_name, headline, active, founding_until)
  select null, 'filler' || g, 'x', true, now() + interval '1 month' from generate_series(1, 19) g;
insert into public.skillfirms_experts (profile_id, display_name, headline, active, approved_at) values ((select id from public.profiles where id <> (select id from k) order by created_at limit 1), 'T38b', 'x', true, now());
do $$ begin
  if (select founding_until from public.skillfirms_experts where display_name = 'T38b') is not null then raise exception 'FAIL: 21st tutor got founding'; end if;
  if (public.skillfirms_founding_tutors()->>'spots_left')::int <> 0 then raise exception 'FAIL: spots'; end if;
  raise notice 'PASS: only the first 20 tutors get it';
end $$;
rollback;
