-- Instructors: only public columns can be read through the API. Payout share
-- and referral code stay private (the expert gets their code via
-- skillfirms_my_ref_code; payouts are worked out server-side).
revoke select on public.skillfirms_experts from anon, authenticated;
grant select (id, profile_id, display_name, headline, bio, credentials, rating_avg, rating_count, active, approved_at, created_at)
  on public.skillfirms_experts to anon, authenticated;
