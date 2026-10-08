-- skillfirms_experts.profile_id originally required a real auth.users
-- account (shared identity, see 0001). That's right for real marketplace
-- experts, but the bootstrap catalog (0007) needs placeholder experts so
-- the marketplace isn't empty at launch -- and manufacturing fake
-- auth.users/profiles rows just to satisfy that FK would mean planting
-- junk login-capable accounts nobody owns, which is worse. So a
-- catalog-only expert can instead carry a plain display_name; a real
-- expert (profile_id set) always wins once one exists.
alter table public.skillfirms_experts alter column profile_id drop not null;
alter table public.skillfirms_experts add column display_name text check (char_length(display_name) between 1 and 160);
alter table public.skillfirms_experts add constraint skillfirms_experts_identity_check check (profile_id is not null or display_name is not null);
