-- 009_views.sql
-- Required views: project progress, unresolved feedback, contribution summary, faculty risk dashboard.
SET search_path = projectpulse, public;

-- 1. Project progress (weighted by milestone weightage; approved milestone = 100%)
CREATE OR REPLACE VIEW v_project_progress AS
SELECT p.project_id, p.title, p.status AS project_status,
       COUNT(m.milestone_id)                                         AS milestone_count,
       COUNT(*) FILTER (WHERE m.status = 'approved')                 AS milestones_approved,
       COALESCE(ROUND(SUM(m.weightage * fn_milestone_completion_pct(m.milestone_id)) / NULLIF(SUM(m.weightage),0), 1), 0)
                                                                      AS progress_pct
FROM projects p
LEFT JOIN milestones m ON m.project_id = p.project_id
GROUP BY p.project_id, p.title, p.status;

-- 2. Unresolved feedback (open / in_progress / reopened / resolved-but-not-verified)
CREATE OR REPLACE VIEW v_unresolved_feedback AS
SELECT f.feedback_id, f.description, f.severity, f.resolution_status, f.due_date,
       (f.due_date IS NOT NULL AND f.due_date < CURRENT_DATE)         AS is_overdue,
       r.review_id, m.milestone_id, m.title AS milestone_title,
       p.project_id, p.title AS project_title, t.team_name,
       u.user_id AS assigned_user_id, u.name AS assigned_to,
       CURRENT_DATE - f.created_at::date                               AS age_days
FROM feedback_items f
JOIN reviews r     ON r.review_id = f.review_id
JOIN milestones m  ON m.milestone_id = r.milestone_id
JOIN projects p    ON p.project_id = m.project_id
JOIN teams t       ON t.team_id = p.team_id
JOIN users u       ON u.user_id = f.assigned_user_id
WHERE f.resolution_status <> 'verified';

-- 3. Contribution summary per member (verified evidence only) + share of team total
CREATE OR REPLACE VIEW v_contribution_summary AS
WITH per_member AS (
  SELECT p.project_id, tm.user_id,
         COALESCE(SUM(ce.weight * CASE ce.evidence_type
                WHEN 'task_completed' THEN 3 WHEN 'document_upload' THEN 2
                WHEN 'feedback_resolved' THEN 2 WHEN 'review_participation' THEN 1
                WHEN 'git_activity' THEN 1 END) FILTER (WHERE ce.verified_flag), 0) AS evidence_points,
         COUNT(ce.evidence_id) FILTER (WHERE ce.verified_flag)   AS verified_items,
         COUNT(ce.evidence_id) FILTER (WHERE NOT ce.verified_flag) AS unverified_items
  FROM projects p
  JOIN team_members tm ON tm.team_id = p.team_id
  LEFT JOIN contribution_evidence ce ON ce.project_id = p.project_id AND ce.user_id = tm.user_id
  GROUP BY p.project_id, tm.user_id
)
SELECT pm.project_id, pm.user_id, u.name, pm.verified_items, pm.unverified_items, pm.evidence_points,
       ROUND(100 * pm.evidence_points / NULLIF(SUM(pm.evidence_points) OVER (PARTITION BY pm.project_id), 0), 1)
                                                                  AS share_pct,
       ROUND(AVG(pe.score), 2)                                    AS avg_peer_score
FROM per_member pm
JOIN users u ON u.user_id = pm.user_id
LEFT JOIN peer_evaluations pe ON pe.project_id = pm.project_id AND pe.evaluatee_id = pm.user_id
GROUP BY pm.project_id, pm.user_id, u.name, pm.verified_items, pm.unverified_items, pm.evidence_points;

-- 4. Faculty risk dashboard (progress, overdue count, missing evidence, unresolved feedback,
--    latest risk score, days remaining) - exactly the columns the proposal lists
CREATE OR REPLACE VIEW v_faculty_risk_dashboard AS
SELECT p.project_id, p.title, p.status AS project_status,
       t.team_id, t.team_name, c.course_id, c.course_name, c.semester,
       ga.user_id AS guide_id,
       pr.progress_pct,
       (SELECT COUNT(*) FROM tasks tk JOIN milestones m ON m.milestone_id = tk.milestone_id
         WHERE m.project_id = p.project_id AND tk.due_date < CURRENT_DATE
           AND tk.status NOT IN ('done','verified'))                              AS overdue_tasks,
       (SELECT COUNT(*) FROM milestone_required_deliverables r JOIN milestones m ON m.milestone_id = r.milestone_id
         WHERE m.project_id = p.project_id AND m.due_date <= CURRENT_DATE + 7 AND m.status <> 'approved'
           AND NOT EXISTS (SELECT 1 FROM deliverables d WHERE d.milestone_id = m.milestone_id
                             AND d.deliverable_type = r.deliverable_type AND d.status IN ('submitted','accepted')))
                                                                                    AS missing_evidence,
       (SELECT COUNT(*) FROM v_unresolved_feedback uf WHERE uf.project_id = p.project_id) AS unresolved_feedback,
       lr.risk_score, lr.risk_level, lr.reason, lr.calculated_at,
       (SELECT MIN(m.due_date) FROM milestones m
         WHERE m.project_id = p.project_id AND m.status <> 'approved') - CURRENT_DATE AS days_to_next_deadline
FROM projects p
JOIN teams t   ON t.team_id = p.team_id
JOIN courses c ON c.course_id = p.course_id
JOIN v_project_progress pr ON pr.project_id = p.project_id
LEFT JOIN guide_allocations ga ON ga.project_id = p.project_id AND ga.allocation_role = 'guide'
LEFT JOIN LATERAL (SELECT ra.* FROM risk_assessments ra WHERE ra.project_id = p.project_id
                   ORDER BY ra.calculated_at DESC LIMIT 1) lr ON TRUE
WHERE p.status IN ('approved','in_progress');

-- Extra views
CREATE OR REPLACE VIEW v_overdue_tasks_by_team AS
SELECT t.team_id, t.team_name, c.course_id, c.course_name, COUNT(*) AS overdue_tasks,
       MAX(CURRENT_DATE - tk.due_date) AS max_days_late
FROM tasks tk
JOIN milestones m ON m.milestone_id = tk.milestone_id
JOIN projects p   ON p.project_id = m.project_id
JOIN teams t      ON t.team_id = p.team_id
JOIN courses c    ON c.course_id = p.course_id
WHERE tk.due_date < CURRENT_DATE AND tk.status NOT IN ('done','verified')
GROUP BY t.team_id, t.team_name, c.course_id, c.course_name;

CREATE OR REPLACE VIEW v_missing_mandatory_deliverables AS
SELECT p.project_id, p.title AS project_title, m.milestone_id, m.title AS milestone_title,
       m.due_date, r.deliverable_type AS missing_type
FROM projects p
JOIN milestones m ON m.project_id = p.project_id
JOIN milestone_required_deliverables r ON r.milestone_id = m.milestone_id
WHERE m.due_date <= CURRENT_DATE + 7 AND m.status <> 'approved'
  AND NOT EXISTS (SELECT 1 FROM deliverables d WHERE d.milestone_id = m.milestone_id
                    AND d.deliverable_type = r.deliverable_type AND d.status IN ('submitted','accepted'));

CREATE OR REPLACE VIEW v_latest_risk AS
SELECT DISTINCT ON (project_id) project_id, risk_score, risk_level, reason, breakdown, calculated_at
FROM risk_assessments
ORDER BY project_id, calculated_at DESC;
