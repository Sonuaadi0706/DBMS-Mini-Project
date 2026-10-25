-- 007_indexes.sql
-- Indexes chosen for the workflow queries in db/queries/important_queries.sql.
-- PK / UNIQUE constraints already create their own indexes; these cover the filters and joins
-- the dashboards run (status, due dates, assignee, feedback state, risk level, document metadata).
SET search_path = projectpulse, public;

CREATE INDEX idx_projects_status          ON projects(status);
CREATE INDEX idx_projects_course_status   ON projects(course_id, status);
CREATE INDEX idx_milestones_due_status    ON milestones(due_date, status);
CREATE INDEX idx_milestones_project       ON milestones(project_id, sequence_no);
CREATE INDEX idx_tasks_milestone_status   ON tasks(milestone_id, status);
-- partial: only open tasks can be overdue, so the index stays small
CREATE INDEX idx_tasks_due_open           ON tasks(due_date) WHERE status NOT IN ('done','verified');
CREATE INDEX idx_task_assign_user         ON task_assignments(user_id);        -- "task assignee"
CREATE INDEX idx_feedback_status          ON feedback_items(resolution_status);
CREATE INDEX idx_feedback_assignee_open   ON feedback_items(assigned_user_id)
                                          WHERE resolution_status IN ('open','in_progress','reopened');
CREATE INDEX idx_reviews_milestone        ON reviews(milestone_id);
CREATE INDEX idx_risk_project_time        ON risk_assessments(project_id, calculated_at DESC);
CREATE INDEX idx_risk_level               ON risk_assessments(risk_level);      -- "risk category"
CREATE INDEX idx_evidence_project_user    ON contribution_evidence(project_id, user_id) WHERE verified_flag;
CREATE INDEX idx_deliverables_milestone   ON deliverables(milestone_id, deliverable_type, status); -- "document metadata"
CREATE INDEX idx_docver_deliverable       ON document_versions(deliverable_id, version_number DESC);
CREATE INDEX idx_audit_entity             ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_user_time          ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_team_members_user        ON team_members(user_id);
CREATE INDEX idx_similarity_decision      ON similarity_reviews(faculty_decision);
CREATE INDEX idx_notifications_unread     ON notifications(user_id) WHERE NOT is_read;

-- Full-text search on proposals (extra advanced feature). The query must use the SAME expression.
CREATE INDEX idx_projects_fts ON projects USING GIN (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,'') || ' ' || coalesce(problem_statement,'')));

-- Vector index (pgvector): cosine distance, HNSW
CREATE INDEX idx_embeddings_hnsw ON project_embeddings
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_embeddings_filter ON project_embeddings(course_id, section_type) WHERE is_current;
