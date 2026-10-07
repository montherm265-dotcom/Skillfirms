-- Flagship demo path (brief section 43): Mechanical Engineer -> Pharma
-- CQV, plus secondary example paths (Project Manager, Data Analyst, AI
-- Engineer, Product Manager). This is real reference data an admin can
-- edit later -- not fabricated per-user history. No user_skill_state
-- rows are seeded here: a person's starting proficiency only ever comes
-- from a real AI diagnosis run against what they actually typed, never
-- from a pre-planted "demo account."
insert into public.skillfirms_skills (slug, name, category) values
  ('mechanical_engineering', 'Mechanical Engineering', 'engineering_fundamentals'),
  ('project_fundamentals', 'Project Fundamentals', 'engineering_fundamentals'),
  ('pid_interpretation', 'P&ID Interpretation', 'facilities_systems'),
  ('pharmaceutical_industry', 'Pharmaceutical Industry Knowledge', 'industry_knowledge'),
  ('gmp', 'Good Manufacturing Practice (GMP)', 'compliance_quality'),
  ('commissioning', 'Commissioning', 'validation_commissioning'),
  ('qualification', 'Qualification', 'validation_commissioning'),
  ('validation', 'Validation', 'validation_commissioning'),
  ('iq', 'Installation Qualification (IQ)', 'validation_commissioning'),
  ('oq', 'Operational Qualification (OQ)', 'validation_commissioning'),
  ('pq', 'Performance Qualification (PQ)', 'validation_commissioning'),
  ('dq', 'Design Qualification (DQ)', 'validation_commissioning'),
  ('hvac', 'HVAC Systems', 'facilities_systems'),
  ('cleanroom_fundamentals', 'Cleanroom Fundamentals', 'facilities_systems'),
  ('risk_assessment', 'Risk Assessment', 'compliance_quality'),
  ('documentation', 'Technical Documentation', 'documentation'),
  ('deviation_management', 'Deviation Management', 'compliance_quality'),
  ('capa', 'CAPA (Corrective & Preventive Action)', 'compliance_quality'),
  ('change_control', 'Change Control', 'compliance_quality'),
  ('urs', 'User Requirements Specification (URS)', 'documentation'),
  ('stakeholder_management', 'Stakeholder Management', 'project_management'),
  ('schedule_management', 'Schedule Management', 'project_management'),
  ('budget_management', 'Budget Management', 'project_management'),
  ('agile_methodology', 'Agile Methodology', 'project_management'),
  ('data_analysis', 'Data Analysis', 'data_analytics'),
  ('sql', 'SQL', 'data_analytics'),
  ('statistics', 'Statistics', 'data_analytics'),
  ('data_visualization', 'Data Visualization', 'data_analytics'),
  ('python_for_data', 'Python for Data', 'data_analytics'),
  ('python_programming', 'Python Programming', 'software_ai'),
  ('machine_learning', 'Machine Learning', 'software_ai'),
  ('deep_learning', 'Deep Learning', 'software_ai'),
  ('mlops', 'MLOps', 'software_ai'),
  ('data_structures_algorithms', 'Data Structures & Algorithms', 'software_ai'),
  ('product_strategy', 'Product Strategy', 'product'),
  ('user_research', 'User Research', 'product'),
  ('roadmapping', 'Roadmapping', 'product');

insert into public.skillfirms_skill_relationships (skill_id, related_skill_id, relationship_type)
select s1.id, s2.id, rel.relationship_type from (values
  ('gmp', 'validation', 'prerequisite'),
  ('validation', 'commissioning', 'related'),
  ('commissioning', 'qualification', 'related'),
  ('urs', 'dq', 'prerequisite'),
  ('dq', 'iq', 'prerequisite'),
  ('iq', 'oq', 'prerequisite'),
  ('oq', 'pq', 'prerequisite'),
  ('pid_interpretation', 'hvac', 'related'),
  ('hvac', 'cleanroom_fundamentals', 'related')
) as rel(skill_slug, related_slug, relationship_type)
join public.skillfirms_skills s1 on s1.slug = rel.skill_slug
join public.skillfirms_skills s2 on s2.slug = rel.related_slug;

insert into public.skillfirms_career_roles (slug, title, description, industry) values
  ('mechanical_engineer', 'Mechanical Engineer', 'Designs and analyzes mechanical systems and components.', 'Engineering'),
  ('project_engineer', 'Project Engineer', 'Runs the engineering side of a capital project -- scope, schedule, technical coordination.', 'Engineering'),
  ('cqv_engineer', 'Pharmaceutical CQV Engineer', 'Commissions, qualifies, and validates pharmaceutical manufacturing systems and facilities against GMP requirements.', 'Pharmaceutical'),
  ('senior_cqv_engineer', 'Senior CQV Engineer', 'Leads CQV execution on complex systems and mentors junior engineers.', 'Pharmaceutical'),
  ('cqv_lead', 'CQV Lead', 'Owns the CQV strategy and schedule for a project or program.', 'Pharmaceutical'),
  ('cqv_manager', 'CQV Manager', 'Manages a CQV team, budget, and cross-functional stakeholders.', 'Pharmaceutical'),
  ('project_manager', 'Project Manager', 'Plans and delivers projects against scope, schedule, and budget.', 'Cross-industry'),
  ('data_analyst', 'Data Analyst', 'Turns raw data into decisions -- queries, statistics, visualization.', 'Cross-industry'),
  ('ai_engineer', 'AI Engineer', 'Builds and ships machine learning systems in production.', 'Software'),
  ('product_manager', 'Product Manager', 'Defines what gets built and why, working across design, engineering, and the business.', 'Cross-industry');

insert into public.skillfirms_role_progressions (from_role_id, to_role_id)
select r1.id, r2.id from (values
  ('mechanical_engineer', 'project_engineer'),
  ('project_engineer', 'cqv_engineer'),
  ('cqv_engineer', 'senior_cqv_engineer'),
  ('senior_cqv_engineer', 'cqv_lead'),
  ('cqv_lead', 'cqv_manager')
) as prog(from_slug, to_slug)
join public.skillfirms_career_roles r1 on r1.slug = prog.from_slug
join public.skillfirms_career_roles r2 on r2.slug = prog.to_slug;

insert into public.skillfirms_role_skills (role_id, skill_id, importance, weight)
select r.id, s.id, rs.importance, rs.weight from (values
  ('mechanical_engineer', 'mechanical_engineering', 'required', 0.95),
  ('mechanical_engineer', 'project_fundamentals', 'required', 0.6),
  ('mechanical_engineer', 'pid_interpretation', 'preferred', 0.5),

  ('project_engineer', 'project_fundamentals', 'required', 0.9),
  ('project_engineer', 'documentation', 'required', 0.7),
  ('project_engineer', 'risk_assessment', 'required', 0.6),
  ('project_engineer', 'change_control', 'required', 0.5),
  ('project_engineer', 'mechanical_engineering', 'preferred', 0.6),
  ('project_engineer', 'pid_interpretation', 'preferred', 0.5),

  ('cqv_engineer', 'gmp', 'required', 0.95),
  ('cqv_engineer', 'validation', 'required', 0.95),
  ('cqv_engineer', 'commissioning', 'required', 0.9),
  ('cqv_engineer', 'qualification', 'required', 0.9),
  ('cqv_engineer', 'iq', 'required', 0.85),
  ('cqv_engineer', 'oq', 'required', 0.85),
  ('cqv_engineer', 'pq', 'required', 0.85),
  ('cqv_engineer', 'dq', 'required', 0.7),
  ('cqv_engineer', 'documentation', 'required', 0.8),
  ('cqv_engineer', 'risk_assessment', 'required', 0.75),
  ('cqv_engineer', 'deviation_management', 'required', 0.65),
  ('cqv_engineer', 'capa', 'required', 0.6),
  ('cqv_engineer', 'change_control', 'required', 0.6),
  ('cqv_engineer', 'urs', 'preferred', 0.5),
  ('cqv_engineer', 'pid_interpretation', 'preferred', 0.55),
  ('cqv_engineer', 'hvac', 'preferred', 0.5),
  ('cqv_engineer', 'cleanroom_fundamentals', 'preferred', 0.55),
  ('cqv_engineer', 'pharmaceutical_industry', 'preferred', 0.6),
  ('cqv_engineer', 'mechanical_engineering', 'preferred', 0.4),
  ('cqv_engineer', 'project_fundamentals', 'preferred', 0.4),

  ('senior_cqv_engineer', 'gmp', 'required', 0.95),
  ('senior_cqv_engineer', 'validation', 'required', 0.95),
  ('senior_cqv_engineer', 'commissioning', 'required', 0.9),
  ('senior_cqv_engineer', 'qualification', 'required', 0.9),
  ('senior_cqv_engineer', 'iq', 'required', 0.85),
  ('senior_cqv_engineer', 'oq', 'required', 0.85),
  ('senior_cqv_engineer', 'pq', 'required', 0.85),
  ('senior_cqv_engineer', 'capa', 'required', 0.85),
  ('senior_cqv_engineer', 'change_control', 'required', 0.8),
  ('senior_cqv_engineer', 'documentation', 'required', 0.85),
  ('senior_cqv_engineer', 'risk_assessment', 'required', 0.8),
  ('senior_cqv_engineer', 'deviation_management', 'required', 0.75),
  ('senior_cqv_engineer', 'dq', 'preferred', 0.6),
  ('senior_cqv_engineer', 'urs', 'preferred', 0.5),

  ('cqv_lead', 'gmp', 'required', 0.9),
  ('cqv_lead', 'validation', 'required', 0.9),
  ('cqv_lead', 'stakeholder_management', 'required', 0.8),
  ('cqv_lead', 'change_control', 'required', 0.85),
  ('cqv_lead', 'capa', 'required', 0.85),
  ('cqv_lead', 'documentation', 'required', 0.8),
  ('cqv_lead', 'commissioning', 'preferred', 0.6),
  ('cqv_lead', 'qualification', 'preferred', 0.6),

  ('cqv_manager', 'stakeholder_management', 'required', 0.9),
  ('cqv_manager', 'change_control', 'required', 0.9),
  ('cqv_manager', 'capa', 'required', 0.85),
  ('cqv_manager', 'budget_management', 'required', 0.7),
  ('cqv_manager', 'documentation', 'required', 0.8),
  ('cqv_manager', 'gmp', 'preferred', 0.7),
  ('cqv_manager', 'validation', 'preferred', 0.6),

  ('project_manager', 'project_fundamentals', 'required', 0.9),
  ('project_manager', 'stakeholder_management', 'required', 0.85),
  ('project_manager', 'schedule_management', 'required', 0.85),
  ('project_manager', 'budget_management', 'required', 0.7),
  ('project_manager', 'risk_assessment', 'required', 0.7),
  ('project_manager', 'change_control', 'required', 0.6),
  ('project_manager', 'agile_methodology', 'preferred', 0.5),

  ('data_analyst', 'data_analysis', 'required', 0.9),
  ('data_analyst', 'sql', 'required', 0.85),
  ('data_analyst', 'statistics', 'required', 0.8),
  ('data_analyst', 'data_visualization', 'required', 0.75),
  ('data_analyst', 'python_for_data', 'preferred', 0.6),

  ('ai_engineer', 'python_programming', 'required', 0.9),
  ('ai_engineer', 'machine_learning', 'required', 0.9),
  ('ai_engineer', 'deep_learning', 'required', 0.8),
  ('ai_engineer', 'data_structures_algorithms', 'required', 0.75),
  ('ai_engineer', 'mlops', 'preferred', 0.6),

  ('product_manager', 'product_strategy', 'required', 0.9),
  ('product_manager', 'user_research', 'required', 0.8),
  ('product_manager', 'stakeholder_management', 'required', 0.75),
  ('product_manager', 'roadmapping', 'required', 0.8),
  ('product_manager', 'agile_methodology', 'preferred', 0.6)
) as rs(role_slug, skill_slug, importance, weight)
join public.skillfirms_career_roles r on r.slug = rs.role_slug
join public.skillfirms_skills s on s.slug = rs.skill_slug;
