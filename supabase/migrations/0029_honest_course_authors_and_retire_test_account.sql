-- The 4 placeholder "experts" behind the catalogue were made-up people
-- (no account, invented bios). Courses must point at an author, so they
-- become plain "Skillfirms" with no invented details, and can't review.
update public.skillfirms_experts
set display_name = 'Skillfirms', headline = 'Course outline by Skillfirms', bio = null, credentials = null, active = false
where profile_id is null;

-- Retire the QA account used for sign-in and lesson tests.
update auth.users set banned_until = now() + interval '100 years'
where id = 'eeee1115-0000-4000-8000-0000000000b5';
update public.profiles set display_name = 'Retired test account'
where id = 'eeee1115-0000-4000-8000-0000000000b5';
