-- assemblePath() (src/lib/path.js) did delete-then-insert-then-insert as
-- three separate client round trips -- not atomic, and
-- skillfirms_user_learning_paths has unique(user_id, goal_id).
-- LearningPath.jsx calls this from a plain useEffect with no request-id
-- guard or busy-lock (unlike Talfirms' CompanyHiring.jsx and friends),
-- so two concurrent calls for the same user+goal (two tabs, rapid
-- back-and-forth navigation, React StrictMode's dev-mode double-invoke)
-- could both pass the delete, then race on the insert: one succeeds,
-- the other raises a raw "duplicate key value violates unique
-- constraint" straight to the user via setError(err.message) -- the
-- exact TOCTOU-retry bug class the main Talfirms session already found
-- and fixed repeatedly (migrations 0124-0131 there), just not yet
-- caught here.
--
-- Fix: two atomic RPCs instead of three client round trips.
-- skillfirms_upsert_learning_path upserts the path row (same id
-- survives a re-save, so no window for the duplicate-key race).
-- skillfirms_replace_path_items replaces that path's items.
--
-- Split into two functions, not one, and the second one split again
-- into an inner DML-only function plus a thin checking wrapper that
-- calls it -- purely to work around this project's own tooling: a
-- single PL/pgSQL function body combining an ownership check (SELECT
-- INTO / IF / RAISE) with a DELETE statement reliably hung this
-- project's migration tooling on creation (confirmed repeatedly, with
-- every other combination -- check-only, DML-only, check+single-INSERT
-- -- creating fine). Wrapping the proven-safe DML in its own already-
-- created function and calling it via PERFORM from the checking
-- wrapper avoided the hang. The security boundary is real, not
-- cosmetic: skillfirms_replace_path_items itself has no execute grant
-- for authenticated/anon at all, reachable only through
-- skillfirms_replace_my_path_items's ownership check -- verified live
-- (a direct call from a non-owner gets a clean 42501 permission-denied,
-- a non-owner's call through the wrapper gets 'learning path not
-- found' with zero rows touched, and the legitimate owner's path
-- through the wrapper works end to end).
create or replace function public.skillfirms_upsert_learning_path(p_goal_id uuid, p_target_role_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_path_id uuid;
begin
  if not exists (
    select 1 from public.skillfirms_user_career_goals
    where id = p_goal_id and user_id = (select auth.uid())
  ) then
    raise exception 'career goal not found';
  end if;

  insert into public.skillfirms_user_learning_paths (user_id, goal_id, target_role_id)
  values ((select auth.uid()), p_goal_id, p_target_role_id)
  on conflict (user_id, goal_id) do update set target_role_id = excluded.target_role_id
  returning id into v_path_id;

  return v_path_id;
end;
$$;

revoke all on function public.skillfirms_upsert_learning_path(uuid, uuid) from public, anon;
grant execute on function public.skillfirms_upsert_learning_path(uuid, uuid) to authenticated;

-- DML only, no ownership check -- not callable directly by any client
-- role (see grants below). Relies entirely on the caller (the wrapper
-- below) having already verified ownership of p_path_id.
create or replace function public.skillfirms_replace_path_items(p_path_id uuid, p_items jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.skillfirms_path_items where path_id = p_path_id;

  insert into public.skillfirms_path_items (path_id, course_id, order_index, primary_skill_id, gap_weight)
  select p_path_id, (item->>'course_id')::uuid, (item->>'order_index')::int, (item->>'primary_skill_id')::uuid, (item->>'gap_weight')::numeric
  from jsonb_array_elements(p_items) as item;
end;
$$;

revoke all on function public.skillfirms_replace_path_items(uuid, jsonb) from public, anon, authenticated;

create or replace function public.skillfirms_replace_my_path_items(p_path_id uuid, p_items jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_verified_path_id uuid;
begin
  select id into v_verified_path_id
  from public.skillfirms_user_learning_paths
  where id = p_path_id and user_id = (select auth.uid());

  if v_verified_path_id is null then
    raise exception 'learning path not found';
  end if;

  perform public.skillfirms_replace_path_items(v_verified_path_id, p_items);
end;
$$;

revoke all on function public.skillfirms_replace_my_path_items(uuid, jsonb) from public, anon;
grant execute on function public.skillfirms_replace_my_path_items(uuid, jsonb) to authenticated;
