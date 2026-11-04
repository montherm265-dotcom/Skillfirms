-- One writer per lesson: the skillfirms-lesson Edge Function claims a lesson
-- before writing it, so two people opening the same new lesson at the same
-- moment don't both pay for it. A claim older than 3 minutes (a crashed
-- run) or a failed one can be taken over. Also caps how many new lessons
-- one person can cause to be written per day.
create or replace function public.skillfirms_claim_lesson(p_module_id uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.skillfirms_lessons;
begin
  select * into v_row from public.skillfirms_lessons where module_id = p_module_id for update;
  if v_row.status = 'ready' then return 'ready'; end if;
  if v_row.status = 'generating' and v_row.generated_at > now() - interval '3 minutes' then return 'busy'; end if;
  if (select count(*) from public.skillfirms_lessons where generated_by = p_user and generated_at > now() - interval '24 hours') >= 100 then
    return 'limit';
  end if;
  insert into public.skillfirms_lessons (module_id, status, generated_by, generated_at, error)
  values (p_module_id, 'generating', p_user, now(), null)
  on conflict (module_id) do update set status = 'generating', generated_by = p_user, generated_at = now(), error = null;
  return 'claimed';
end;
$$;
revoke all on function public.skillfirms_claim_lesson(uuid, uuid) from public, anon, authenticated;
