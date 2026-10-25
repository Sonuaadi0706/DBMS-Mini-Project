-- 014_reference_data.sql  (reference data only; demo data lives in scripts/seed.ts)
SET search_path = projectpulse, public;

INSERT INTO roles(role_name, description) VALUES
  ('student','Creates proposals, works on tasks, submits evidence'),
  ('faculty_guide','Reviews, gives feedback, approves milestones'),
  ('reviewer','Reviews allocated submissions'),
  ('admin','Manages users, courses, allocations, reports');

INSERT INTO status_transitions(entity_type, from_status, to_status) VALUES
 -- project / proposal
 ('project','draft','submitted'),
 ('project','submitted','approved'), ('project','submitted','rejected'), ('project','submitted','revision_requested'),
 ('project','revision_requested','submitted'),
 ('project','approved','in_progress'), ('project','in_progress','completed'),
 ('project','completed','archived'), ('project','rejected','archived'),
 -- milestone
 ('milestone','planned','in_progress'), ('milestone','in_progress','submitted'),
 ('milestone','submitted','under_review'), ('milestone','under_review','approved'),
 ('milestone','under_review','revision_requested'), ('milestone','under_review','rejected'),
 ('milestone','revision_requested','in_progress'), ('milestone','rejected','in_progress'),
 -- task
 ('task','todo','in_progress'), ('task','in_progress','blocked'), ('task','blocked','in_progress'),
 ('task','in_progress','done'), ('task','done','in_progress'), ('task','done','verified'),
 -- feedback
 ('feedback','open','in_progress'), ('feedback','open','resolved'), ('feedback','in_progress','resolved'),
 ('feedback','resolved','verified'), ('feedback','resolved','reopened'),
 ('feedback','reopened','in_progress'), ('feedback','reopened','resolved'),
 -- deliverable
 ('deliverable','draft','submitted'), ('deliverable','submitted','accepted'),
 ('deliverable','submitted','rejected'), ('deliverable','rejected','draft'),
 -- similarity decision (escalated cases can be resolved later)
 ('similarity','pending','not_similar'), ('similarity','pending','acceptable_overlap'),
 ('similarity','pending','needs_revision'), ('similarity','pending','escalated'),
 ('similarity','escalated','not_similar'), ('similarity','escalated','acceptable_overlap'),
 ('similarity','escalated','needs_revision');
