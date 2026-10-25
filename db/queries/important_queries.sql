-- ProjectPulse: important queries (spec section 10.2). Run in psql with `\set` variables, or let
-- db/tests/queries.test.ts execute every block with sample parameters ($1, $2 ... are bound parameters).
-- Each block starts with "-- Q<n>" so a test can split the file. Concepts shown are named after the title.
SET search_path = projectpulse, public;

-- Q1 High-risk projects for a guide  [view + JOIN + ORDER BY]            params: $1 = guide user_id
SELECT d.project_id, d.title, d.team_name, d.course_name, d.risk_score, d.risk_level, d.reason, d.days_to_next_deadline
FROM v_faculty_risk_dashboard d
WHERE d.guide_id = $1 AND d.risk_level IN ('high','critical')
ORDER BY d.risk_score DESC, d.days_to_next_deadline ASC;

-- Q2 Teams with more than N overdue tasks  [JOIN + GROUP BY + HAVING + date arithmetic]   params: $1 = N
SELECT t.team_id, t.team_name, COUNT(*) AS overdue_tasks, MAX(CURRENT_DATE - tk.due_date) AS max_days_late
FROM tasks tk
JOIN milestones m ON m.milestone_id = tk.milestone_id
JOIN projects p   ON p.project_id = m.project_id
JOIN teams t      ON t.team_id = p.team_id
WHERE tk.due_date < CURRENT_DATE AND tk.status NOT IN ('done','verified')
GROUP BY t.team_id, t.team_name
HAVING COUNT(*) > $1
ORDER BY overdue_tasks DESC;

-- Q3 Contribution comparison inside a team  [conditional aggregation, LEFT JOIN]   params: $1 = project_id
SELECT u.name,
       COUNT(*) FILTER (WHERE ce.evidence_type = 'task_completed'   AND ce.verified_flag) AS tasks_verified,
       COUNT(*) FILTER (WHERE ce.evidence_type = 'document_upload'  AND ce.verified_flag) AS docs,
       COUNT(*) FILTER (WHERE ce.evidence_type = 'feedback_resolved' AND ce.verified_flag) AS feedback_resolved,
       SUM(ce.weight) FILTER (WHERE ce.verified_flag) AS weighted_points
FROM team_members tm
JOIN projects p ON p.team_id = tm.team_id
JOIN users u ON u.user_id = tm.user_id
LEFT JOIN contribution_evidence ce ON ce.project_id = p.project_id AND ce.user_id = tm.user_id
WHERE p.project_id = $1
GROUP BY u.user_id, u.name
ORDER BY weighted_points DESC NULLS LAST;

-- Q4a Milestones that still have unresolved feedback  [JOIN + GROUP BY]   params: $1 = project_id
SELECT m.milestone_id, m.title, COUNT(f.feedback_id) AS open_items
FROM milestones m
JOIN reviews r ON r.milestone_id = m.milestone_id
JOIN feedback_items f ON f.review_id = r.review_id
WHERE m.project_id = $1 AND f.resolution_status <> 'verified'
GROUP BY m.milestone_id, m.title;

-- Q4b Approved milestones with NO unresolved feedback  [correlated subquery, NOT EXISTS anti-join]
SELECT m.milestone_id, m.title
FROM milestones m
WHERE m.status = 'approved' AND NOT EXISTS (
  SELECT 1 FROM reviews r JOIN feedback_items f ON f.review_id = r.review_id
  WHERE r.milestone_id = m.milestone_id AND f.resolution_status <> 'verified');

-- Q5 Projects lacking mandatory deliverable types  [LEFT JOIN anti-join + GROUP BY / HAVING]
SELECT p.project_id, p.title, COUNT(*) AS missing_types
FROM projects p
JOIN milestones m ON m.project_id = p.project_id
JOIN milestone_required_deliverables r ON r.milestone_id = m.milestone_id
LEFT JOIN deliverables d ON d.milestone_id = m.milestone_id
      AND d.deliverable_type = r.deliverable_type AND d.status IN ('submitted','accepted')
WHERE d.deliverable_id IS NULL AND m.due_date <= CURRENT_DATE + 7
GROUP BY p.project_id, p.title
HAVING COUNT(*) >= 1
ORDER BY missing_types DESC;

-- Q6 Similar proposals  [pgvector cosine distance + metadata filter]   params: $1 = query vector, $2 = course_id, $3 = project to exclude, $4 = limit
SELECT p.project_id, p.title, e.section_type, e.chunk_text,
       1 - (e.embedding <=> $1::vector) AS cosine_similarity
FROM project_embeddings e
JOIN projects p ON p.project_id = e.project_id
WHERE e.is_current AND e.course_id = $2 AND e.project_id <> $3
ORDER BY e.embedding <=> $1::vector
LIMIT $4;

-- Q7 Latest risk per project  [DISTINCT ON]
SELECT DISTINCT ON (project_id) project_id, risk_score, risk_level, calculated_at
FROM risk_assessments ORDER BY project_id, calculated_at DESC;

-- Q8 Risk trend for one project  [GROUP BY on a derived date]   params: $1 = project_id
SELECT calculated_at::date AS day, MAX(risk_score) AS score FROM risk_assessments
WHERE project_id = $1 GROUP BY 1 ORDER BY 1;

-- Q9 Guide workload  [JOIN + GROUP BY + FILTER aggregate]
SELECT u.name, COUNT(DISTINCT ga.project_id) AS projects,
       COUNT(DISTINCT ga.project_id) FILTER (WHERE lr.risk_level IN ('high','critical')) AS high_risk
FROM guide_allocations ga JOIN users u ON u.user_id = ga.user_id
LEFT JOIN v_faculty_risk_dashboard lr ON lr.project_id = ga.project_id
WHERE ga.allocation_role = 'guide' GROUP BY u.user_id, u.name ORDER BY projects DESC;

-- Q10 Unapproved milestones past due, by course  [JOIN + date arithmetic]
SELECT c.course_name, t.team_name, m.title, m.due_date, CURRENT_DATE - m.due_date AS days_overdue
FROM milestones m JOIN projects p ON p.project_id = m.project_id
JOIN teams t ON t.team_id = p.team_id JOIN courses c ON c.course_id = p.course_id
WHERE m.status <> 'approved' AND m.due_date < CURRENT_DATE ORDER BY days_overdue DESC;

-- Q11 Students with more open feedback than average  [subquery in HAVING]
SELECT u.name, COUNT(*) AS open_items FROM feedback_items f JOIN users u ON u.user_id = f.assigned_user_id
WHERE f.resolution_status IN ('open','in_progress','reopened')
GROUP BY u.user_id, u.name
HAVING COUNT(*) > (SELECT AVG(c) FROM (SELECT COUNT(*) c FROM feedback_items
                                       WHERE resolution_status IN ('open','in_progress','reopened')
                                       GROUP BY assigned_user_id) s);

-- Q12 Full-text search over proposals  [GIN tsvector index; same expression as idx_projects_fts]   params: $1 = search words
SELECT project_id, title,
       ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,'') || ' ' || coalesce(problem_statement,'')), q) AS rank
FROM projects, plainto_tsquery('english', $1) q
WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,'') || ' ' || coalesce(problem_statement,'')) @@ q
ORDER BY rank DESC;

-- Q13 Feedback turnaround time per guide  [aggregate + interval arithmetic]
SELECT cu.name AS guide, COUNT(*) AS items,
       ROUND(AVG(EXTRACT(EPOCH FROM (f.resolved_at - f.created_at)) / 86400)::numeric, 1) AS avg_days_to_resolve
FROM feedback_items f JOIN users cu ON cu.user_id = f.created_by
WHERE f.resolved_at IS NOT NULL GROUP BY cu.user_id, cu.name;

-- Q14 Projects whose risk is worse than it was a week ago  [self-join on snapshots, DISTINCT ON]
SELECT n.project_id, o.risk_score AS last_week, n.risk_score AS now
FROM (SELECT DISTINCT ON (project_id) * FROM risk_assessments ORDER BY project_id, calculated_at DESC) n
JOIN (SELECT DISTINCT ON (project_id) * FROM risk_assessments WHERE calculated_at < now() - interval '7 days'
      ORDER BY project_id, calculated_at DESC) o USING (project_id)
WHERE n.risk_score > o.risk_score;
