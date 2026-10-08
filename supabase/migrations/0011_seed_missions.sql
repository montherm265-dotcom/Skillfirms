-- Real mission briefs (reference data an admin can edit later, same
-- pattern as the role/skill/course seed data) -- each one deliberately
-- reinforces skills the course catalog already teaches, so the COURSE
-- -> MISSION step in the core loop has somewhere real to land.
insert into public.skillfirms_missions (slug, title, brief, deliverable_instructions, difficulty, estimated_hours, status) values
  (
    'write-a-urs-clean-steam-generator',
    'Write a URS for a Clean Steam Generator',
    'Your pharmaceutical facility is installing a new Clean Steam Generator (CSG) to supply steam for autoclave sterilization and clean-in-place (CIP) systems. Engineering has asked you, the responsible engineer, to draft the User Requirements Specification (URS) before the equipment is sent out for vendor quotes. The system must reliably produce clean steam meeting USP purified water quality standards when condensed, operate continuously during production shifts, and integrate with the facility''s existing GMP documentation and change control processes.',
    'Write a URS covering: (1) process requirements (capacity, pressure, quality standard), (2) safety/compliance requirements, (3) at least 3 testable acceptance criteria that could later be verified during IQ/OQ. Plain text, no special formatting required.',
    'intermediate', 3, 'published'
  ),
  (
    'risk-assess-a-batch-deviation',
    'Risk-Assess a Batch Deviation',
    'During a routine production run, an operator recorded a 4-minute excursion above the validated temperature range (2C above the upper limit for 4 minutes) during a hold step for a sterile injectable batch. The deviation was caught by automated monitoring and the batch was held pending disposition. You are the engineer assigned to write the initial risk assessment.',
    'Write a risk assessment covering: (1) your assessment of likely product impact given the excursion described, (2) what additional information you''d need before making a final disposition call, (3) a recommended CAPA to prevent recurrence.',
    'intermediate', 2, 'published'
  ),
  (
    'facilities-pid-walkdown-memo',
    'P&ID Walkdown Memo for a New Clean Utility Line',
    'A new nitrogen supply line is being tied into an existing cleanroom''s process area. You''ve been handed the P&ID package and asked to write a walkdown memo before commissioning begins, identifying anything that looks like it could affect cleanroom classification or create a cross-contamination risk.',
    'Write a short memo describing: (1) what you would specifically check for on the P&ID regarding pressure cascades and containment, (2) at least 2 concrete failure scenarios worth flagging to the commissioning team, (3) one open question you''d raise before signing off.',
    'beginner', 2, 'published'
  ),
  (
    'churn-dataset-recommendation',
    'Recommend an Action from a Churn Summary',
    'Your team''s dashboard shows: overall monthly churn is 4.2%, but customers on the ''Starter'' plan churn at 9.1% vs 2.0% for ''Pro''. Starter customers who used the product fewer than 3 times in their first 2 weeks churn at 14%, vs 3% for those with 3+ uses. Leadership wants a recommendation this week.',
    'Write up: (1) the SQL query structure you''d use to confirm this pattern in the real database (table/column names can be reasonable assumptions, just state them), (2) your top recommendation and why, (3) one metric you''d track to know if the change worked.',
    'beginner', 2, 'published'
  );

insert into public.skillfirms_mission_skills (mission_id, skill_id, coverage)
select m.id, s.id, ms.coverage from (values
  ('write-a-urs-clean-steam-generator', 'urs', 0.8),
  ('write-a-urs-clean-steam-generator', 'documentation', 0.6),
  ('write-a-urs-clean-steam-generator', 'gmp', 0.3),

  ('risk-assess-a-batch-deviation', 'risk_assessment', 0.75),
  ('risk-assess-a-batch-deviation', 'deviation_management', 0.75),
  ('risk-assess-a-batch-deviation', 'capa', 0.6),

  ('facilities-pid-walkdown-memo', 'pid_interpretation', 0.6),
  ('facilities-pid-walkdown-memo', 'hvac', 0.4),
  ('facilities-pid-walkdown-memo', 'cleanroom_fundamentals', 0.5),

  ('churn-dataset-recommendation', 'data_analysis', 0.6),
  ('churn-dataset-recommendation', 'sql', 0.5),
  ('churn-dataset-recommendation', 'data_visualization', 0.3)
) as ms(mission_slug, skill_slug, coverage)
join public.skillfirms_missions m on m.slug = ms.mission_slug
join public.skillfirms_skills s on s.slug = ms.skill_slug;
