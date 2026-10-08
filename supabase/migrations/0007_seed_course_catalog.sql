-- Bootstrap course catalog (real reference data an admin can replace,
-- same pattern as the role/skill seed in 0002) -- covers every skill in
-- the existing role graph so the path assembler always has a real
-- candidate course for every gap. Placeholder experts use display_name
-- (see 0006) since they aren't real accounts; a real expert signing up
-- later replaces them by editing these rows, never by seeding a fake
-- login. Quiz questions are only written for the flagship CQV-ladder
-- courses -- the rest get a real "Knowledge Check" module with no
-- fabricated quiz content behind it, so the frontend must fall back to
-- a plain completion mark rather than pretend a quiz exists.

insert into public.skillfirms_experts (display_name, headline, bio, credentials) values
  ('Elena Castillo', 'Pharmaceutical CQV & Validation Specialist', 'Twenty years leading commissioning, qualification, and validation programs for sterile and solid-dose manufacturing facilities.', 'Former validation lead on multiple FDA-regulated facility start-ups.'),
  ('Marcus Webb', 'Project Delivery & Product Strategy', 'Runs engineering and product delivery across capital projects and software teams -- scope, schedule, documentation, and stakeholder management.', 'PMP-trained; has delivered projects across pharma, energy, and software.'),
  ('Priya Nair', 'Data & Analytics', 'Data analyst and instructor focused on SQL, statistics, and turning raw data into decisions non-technical stakeholders can act on.', 'Background in applied statistics and BI tooling.'),
  ('Sam Okafor', 'AI & Machine Learning Engineering', 'Ships production ML systems; teaches Python, ML foundations, deep learning, and MLOps from a builder''s perspective.', 'Has taken multiple ML systems from prototype to production.');

insert into public.skillfirms_courses (expert_id, slug, title, description, level, duration_hours, status) values
  ((select id from public.skillfirms_experts where display_name = 'Elena Castillo'), 'gmp-fundamentals-for-validation', 'GMP Fundamentals for Validation Professionals', 'What GMP actually requires and why documentation discipline is non-negotiable in regulated manufacturing.', 'beginner', 6, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Elena Castillo'), 'cqv-bootcamp', 'Commissioning, Qualification & Validation Bootcamp', 'The full IQ/OQ/PQ lifecycle, commissioning-to-validation handoff, and how qualification protocols are actually executed.', 'intermediate', 14, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Elena Castillo'), 'design-qualification-and-urs', 'Design Qualification & Writing a Real URS', 'How to write a User Requirements Specification that holds up through DQ instead of causing rework later.', 'intermediate', 5, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Elena Castillo'), 'risk-based-change-and-deviations', 'Risk-Based Change Control & Deviation Management', 'Deviation handling, CAPA, and change control sized to actual product-quality risk.', 'intermediate', 7, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Elena Castillo'), 'facilities-systems-hvac-cleanroom', 'Facilities Systems: HVAC & Cleanroom Fundamentals', 'HVAC, pressure cascades, cleanroom classification, and reading a P&ID.', 'beginner', 6, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Marcus Webb'), 'technical-documentation-for-engineers', 'Technical Documentation for Engineers', 'Writing specs and records that are clear, verifiable, and traceable.', 'beginner', 4, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Marcus Webb'), 'project-fundamentals-for-engineers', 'Project Fundamentals for Engineers', 'Scope, schedule, and budget discipline for engineers who run project work, not just technical tasks.', 'beginner', 6, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Marcus Webb'), 'mechanical-engineering-refresher', 'Mechanical Engineering Principles Refresher', 'Statics, factors of safety, and tolerancing -- the fundamentals that keep showing up on the job.', 'beginner', 8, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Marcus Webb'), 'stakeholder-and-schedule-management', 'Stakeholder & Schedule Management for Project Leads', 'Keeping a schedule baseline meaningful and stakeholders aligned on a live project.', 'intermediate', 6, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Marcus Webb'), 'budget-management-for-leaders', 'Budget Management for Project Leaders', 'Forecasting, tracking, and defending a project budget.', 'intermediate', 4, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Marcus Webb'), 'agile-methodology-in-practice', 'Agile Methodology in Practice', 'Running real sprints, backlogs, and retros without the cargo-culting.', 'beginner', 4, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Priya Nair'), 'sql-for-analysts', 'SQL for Analysts', 'Querying real relational data -- joins, aggregation, and window functions.', 'beginner', 8, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Priya Nair'), 'statistics-for-decisions', 'Statistics for Data-Driven Decisions', 'The statistics that actually get used in business decisions, not just theory.', 'intermediate', 8, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Priya Nair'), 'data-visualization-storytelling', 'Data Visualization & Storytelling', 'Turning a result into a chart someone will actually act on.', 'intermediate', 6, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Priya Nair'), 'python-for-data-analysis', 'Python for Data Analysis', 'pandas-driven analysis workflows for real datasets.', 'intermediate', 10, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Sam Okafor'), 'python-programming-for-engineers', 'Python Programming for Engineers', 'Core Python, from syntax to writing maintainable scripts.', 'beginner', 10, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Sam Okafor'), 'machine-learning-foundations', 'Machine Learning Foundations', 'The core ML algorithms and when to actually use each one.', 'intermediate', 12, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Sam Okafor'), 'deep-learning-in-practice', 'Deep Learning in Practice', 'Neural network architectures and training them on real data.', 'advanced', 14, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Sam Okafor'), 'mlops-shipping-ml-to-production', 'MLOps: Shipping ML to Production', 'Deploying, monitoring, and retraining models that actually run in production.', 'advanced', 10, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Sam Okafor'), 'data-structures-and-algorithms', 'Data Structures & Algorithms', 'The fundamentals every technical interview and performant system still relies on.', 'intermediate', 12, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Marcus Webb'), 'product-strategy-essentials', 'Product Strategy Essentials', 'Deciding what to build and why, with a real framework behind it.', 'intermediate', 6, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Marcus Webb'), 'user-research-methods', 'User Research Methods', 'Talking to users in a way that actually changes the roadmap.', 'beginner', 5, 'published'),
  ((select id from public.skillfirms_experts where display_name = 'Marcus Webb'), 'roadmapping-for-product-teams', 'Roadmapping for Product Teams', 'Building a roadmap that survives contact with real constraints.', 'intermediate', 5, 'published');

insert into public.skillfirms_course_skills (course_id, skill_id, coverage)
select c.id, s.id, cs.coverage from (values
  ('gmp-fundamentals-for-validation', 'gmp', 0.85),
  ('gmp-fundamentals-for-validation', 'pharmaceutical_industry', 0.5),
  ('cqv-bootcamp', 'validation', 0.8),
  ('cqv-bootcamp', 'commissioning', 0.85),
  ('cqv-bootcamp', 'qualification', 0.85),
  ('cqv-bootcamp', 'iq', 0.8),
  ('cqv-bootcamp', 'oq', 0.8),
  ('cqv-bootcamp', 'pq', 0.8),
  ('design-qualification-and-urs', 'dq', 0.75),
  ('design-qualification-and-urs', 'urs', 0.7),
  ('risk-based-change-and-deviations', 'risk_assessment', 0.7),
  ('risk-based-change-and-deviations', 'deviation_management', 0.8),
  ('risk-based-change-and-deviations', 'capa', 0.8),
  ('risk-based-change-and-deviations', 'change_control', 0.75),
  ('facilities-systems-hvac-cleanroom', 'hvac', 0.65),
  ('facilities-systems-hvac-cleanroom', 'cleanroom_fundamentals', 0.7),
  ('facilities-systems-hvac-cleanroom', 'pid_interpretation', 0.6),
  ('technical-documentation-for-engineers', 'documentation', 0.75),
  ('project-fundamentals-for-engineers', 'project_fundamentals', 0.75),
  ('mechanical-engineering-refresher', 'mechanical_engineering', 0.7),
  ('stakeholder-and-schedule-management', 'stakeholder_management', 0.75),
  ('stakeholder-and-schedule-management', 'schedule_management', 0.75),
  ('budget-management-for-leaders', 'budget_management', 0.7),
  ('agile-methodology-in-practice', 'agile_methodology', 0.7),
  ('sql-for-analysts', 'sql', 0.85),
  ('statistics-for-decisions', 'statistics', 0.8),
  ('data-visualization-storytelling', 'data_visualization', 0.75),
  ('python-for-data-analysis', 'python_for_data', 0.7),
  ('python-for-data-analysis', 'data_analysis', 0.65),
  ('python-programming-for-engineers', 'python_programming', 0.85),
  ('machine-learning-foundations', 'machine_learning', 0.85),
  ('deep-learning-in-practice', 'deep_learning', 0.8),
  ('mlops-shipping-ml-to-production', 'mlops', 0.75),
  ('data-structures-and-algorithms', 'data_structures_algorithms', 0.75),
  ('product-strategy-essentials', 'product_strategy', 0.8),
  ('user-research-methods', 'user_research', 0.75),
  ('roadmapping-for-product-teams', 'roadmapping', 0.75)
) as cs(course_slug, skill_slug, coverage)
join public.skillfirms_courses c on c.slug = cs.course_slug
join public.skillfirms_skills s on s.slug = cs.skill_slug;

insert into public.skillfirms_course_modules (course_id, order_index, title, description, duration_minutes, has_quiz)
select c.id, m.order_index, m.title, m.description, m.duration_minutes, m.has_quiz
from public.skillfirms_courses c
cross join (values
  (0, 'Foundations', 'Core concepts and vocabulary you need before going further.', 25, false),
  (1, 'Core Techniques', 'The main methods and workflows used in practice.', 35, false),
  (2, 'Applied Practice', 'Worked examples and common real-world scenarios.', 30, false),
  (3, 'Knowledge Check', 'A short check to confirm what you''ve retained.', 15, true)
) as m(order_index, title, description, duration_minutes, has_quiz);

insert into public.skillfirms_module_quiz_questions (module_id, order_index, question, choices, correct_index)
select cm.id, q.order_index, q.question, q.choices::jsonb, q.correct_index
from (values
  ('gmp-fundamentals-for-validation', 0, 'What does GMP stand for?', '["Good Manufacturing Practice","General Manufacturing Procedure","Good Material Processing","Government Manufacturing Policy"]', 0),
  ('gmp-fundamentals-for-validation', 1, 'Which document type is a legally binding set of manufacturing quality requirements enforced by regulators like the FDA?', '["A GMP regulation","A marketing brochure","An internal memo","A vendor catalog"]', 0),
  ('gmp-fundamentals-for-validation', 2, 'Why does GMP place such heavy emphasis on documentation?', '["To create more paperwork for its own sake","Because if it isn''t documented, it isn''t considered to have happened for regulatory purposes","To slow down production intentionally","Documentation is optional under GMP"]', 1),

  ('cqv-bootcamp', 0, 'What is the correct general order of CQV qualification stages?', '["PQ, OQ, IQ","IQ, OQ, PQ","OQ, IQ, PQ","PQ, IQ, OQ"]', 1),
  ('cqv-bootcamp', 1, 'What does Installation Qualification (IQ) primarily verify?', '["That the system performs under real production loads","That the equipment was installed correctly per design specifications","That operators are trained","That the product meets spec"]', 1),
  ('cqv-bootcamp', 2, 'What is the main purpose of Operational Qualification (OQ)?', '["Confirming equipment operates as intended across its specified ranges","Confirming the building was constructed to code","Confirming raw materials were purchased correctly","Confirming the sales forecast"]', 0),

  ('design-qualification-and-urs', 0, 'What does a User Requirements Specification (URS) primarily define?', '["The final as-built drawings","What the system must do, from the user''s perspective, before it''s designed","The maintenance schedule after handover","The vendor''s invoice terms"]', 1),
  ('design-qualification-and-urs', 1, 'Design Qualification (DQ) verifies that:', '["The proposed design meets the URS before procurement/build","The system was manufactured on time","Operators enjoyed the training","The warranty period has expired"]', 0),
  ('design-qualification-and-urs', 2, 'If a URS is vague or incomplete, what is the most likely downstream consequence?', '["Nothing, URS quality doesn''t matter","Costly rework or qualification failures discovered later in IQ/OQ/PQ","Faster regulatory approval","Lower project cost"]', 1),

  ('risk-based-change-and-deviations', 0, 'What is a ''deviation'' in a GMP context?', '["Any departure from an approved procedure or specification","A scheduled maintenance task","A type of audit","A marketing deviation"]', 0),
  ('risk-based-change-and-deviations', 1, 'What does CAPA stand for?', '["Corrective and Preventive Action","Certified Audit Process Authorization","Change Approval Process Agreement","Compliance Assessment and Process Audit"]', 0),
  ('risk-based-change-and-deviations', 2, 'Why is change control risk-based rather than one-size-fits-all?', '["Because all changes carry identical risk","So the rigor of review matches the actual impact to product quality and patient safety","To make the process slower for no reason","Risk has no role in change control"]', 1),

  ('facilities-systems-hvac-cleanroom', 0, 'In a pharmaceutical cleanroom, what is the primary purpose of HVAC design?', '["Aesthetic comfort only","Controlling particulates, pressure differentials, temperature, and humidity to protect product quality","Reducing electricity bills","Increasing room noise levels"]', 1),
  ('facilities-systems-hvac-cleanroom', 1, 'What does a P&ID (Piping and Instrumentation Diagram) show?', '["Company org chart","The piping, instrumentation, and control elements of a process system","Employee schedules","Marketing funnel"]', 1),
  ('facilities-systems-hvac-cleanroom', 2, 'Why do cleanrooms typically use pressure cascades between adjacent rooms?', '["To prevent contaminants from migrating from lower-classification to higher-classification spaces","To save on HVAC equipment cost","Pressure cascades have no functional purpose","To make rooms louder"]', 0),

  ('technical-documentation-for-engineers', 0, 'What is the main goal of good technical documentation in an engineering project?', '["To look impressive to clients","To create an accurate, traceable record others can rely on and act on","To use as many technical terms as possible","Documentation has no real goal"]', 1),
  ('technical-documentation-for-engineers', 1, 'What''s a key trait of a well-written technical spec?', '["Ambiguous wherever possible","Clear, unambiguous, and verifiable requirements","As short as possible regardless of completeness","Written only for the author to understand"]', 1),
  ('technical-documentation-for-engineers', 2, 'Why is version control important for technical documents on a project?', '["It isn''t important","So everyone works from the current, approved version instead of an outdated one","To make documents harder to find","To increase email traffic"]', 1),

  ('project-fundamentals-for-engineers', 0, 'What are the three classic constraints every project manages?', '["Scope, schedule, and budget","Color, size, and weight","Marketing, sales, and support","None, projects have no constraints"]', 0),
  ('project-fundamentals-for-engineers', 1, 'What is scope creep?', '["A planned, approved scope expansion","Uncontrolled growth of a project''s scope beyond what was approved","A type of test equipment","A project management certification"]', 1),
  ('project-fundamentals-for-engineers', 2, 'Why do projects use a schedule baseline?', '["To have a fixed reference point for measuring actual progress against the original plan","Baselines serve no purpose","To make the schedule harder to read","Only required for software projects"]', 0),

  ('mechanical-engineering-refresher', 0, 'What does a Factor of Safety represent in mechanical design?', '["The ratio between a material''s failure point and the expected maximum load/stress in service","The total weight of a component","The manufacturing cost multiplier","The number of engineers who reviewed a drawing"]', 0),
  ('mechanical-engineering-refresher', 1, 'In statics, what must be true of a structure in equilibrium?', '["Net force and net moment on it must both be zero","It must be moving at constant high speed","All forces must point the same direction","Equilibrium only applies to liquids"]', 0),
  ('mechanical-engineering-refresher', 2, 'Why do engineers specify material tolerances on drawings?', '["Tolerances are just decoration","To define the acceptable range of variation so parts fit and function correctly when manufactured","To make manufacturing more expensive deliberately","Tolerances apply only to electrical parts"]', 1)
) as q(course_slug, order_index, question, choices, correct_index)
join public.skillfirms_courses c on c.slug = q.course_slug
join public.skillfirms_course_modules cm on cm.course_id = c.id and cm.order_index = 3;
