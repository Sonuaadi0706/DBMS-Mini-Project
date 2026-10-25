-- 008_functions.sql
-- Business calculations live in the database so every client (API, sweep script, psql) gets the
-- same answer. Formulas are documented in the spec section 9.6 and shown in the UI.
SET search_path = projectpulse, public;

-- Milestone completion %: effort-weighted share of tasks that are done/verified; approved = 100.
CREATE OR REPLACE FUNCTION fn_milestone_completion_pct(p_milestone_id INT) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN m.status = 'approved' THEN 100
    WHEN NOT EXISTS (SELECT 1 FROM tasks t WHERE t.milestone_id = m.milestone_id) THEN 0
    ELSE ROUND(100 * (SELECT COALESCE(SUM(t.effort_hours) FILTER (WHERE t.status IN ('done','verified')), 0)
                             / NULLIF(SUM(t.effort_hours), 0)
                      FROM tasks t WHERE t.milestone_id = m.milestone_id), 1)
  END
  FROM milestones m WHERE m.milestone_id = p_milestone_id;
$$;

-- Documentation completeness %: required deliverable types (for milestones due within 7 days
-- or earlier) that already have a submitted/accepted deliverable.
CREATE OR REPLACE FUNCTION fn_documentation_completeness(p_project_id INT) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(ROUND(100.0 * COUNT(x.deliverable_id) / NULLIF(COUNT(*), 0), 1), 0)
  FROM milestone_required_deliverables r
  JOIN milestones m ON m.milestone_id = r.milestone_id
  LEFT JOIN LATERAL (
        SELECT d.deliverable_id FROM deliverables d
        WHERE d.milestone_id = r.milestone_id AND d.deliverable_type = r.deliverable_type
          AND d.status IN ('submitted','accepted') LIMIT 1) x ON TRUE
  WHERE m.project_id = p_project_id AND m.due_date <= CURRENT_DATE + 7;
$$;

-- Contribution indicator (0-100): 80% evidence share + 20% peer-evaluation share.
-- plpgsql (not sql) so it can read the view v_contribution_summary created in migration 009.
CREATE OR REPLACE FUNCTION fn_contribution_indicator(p_project_id INT, p_user_id INT) RETURNS NUMERIC
LANGUAGE plpgsql STABLE AS $$
DECLARE v_result NUMERIC;
BEGIN
  WITH s AS (
    SELECT user_id, share_pct, avg_peer_score,
           SUM(avg_peer_score) OVER () AS peer_total
    FROM v_contribution_summary WHERE project_id = p_project_id)
  SELECT ROUND(0.8 * COALESCE(share_pct, 0)
             + 0.2 * COALESCE(100 * avg_peer_score / NULLIF(peer_total, 0), share_pct, 0), 1)
  INTO v_result FROM s WHERE user_id = p_user_id;
  RETURN COALESCE(v_result, 0);
END $$;

-- Delivery risk: returns score (0-100), level, plain-English reason, and per-factor breakdown.
CREATE OR REPLACE FUNCTION fn_calculate_project_risk(p_project_id INT)
RETURNS TABLE (risk_score NUMERIC, risk_level TEXT, reason TEXT, breakdown JSONB)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_overdue_ms INT; v_overdue_tasks INT; v_missing INT; v_open_fb INT; v_overdue_fb INT;
  v_last_activity TIMESTAMPTZ; v_idle_days INT;
  v_members INT; v_total_pts NUMERIC; v_max_pts NUMERIC;
  pts_ms NUMERIC; pts_tasks NUMERIC; pts_docs NUMERIC; pts_fb NUMERIC; pts_idle NUMERIC; pts_imb NUMERIC;
  v_total NUMERIC; v_level TEXT; v_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT COUNT(*) INTO v_overdue_ms FROM milestones m
   WHERE m.project_id = p_project_id AND m.due_date < CURRENT_DATE AND m.status <> 'approved';

  SELECT COUNT(*) INTO v_overdue_tasks FROM tasks t JOIN milestones m ON m.milestone_id = t.milestone_id
   WHERE m.project_id = p_project_id AND t.due_date < CURRENT_DATE AND t.status NOT IN ('done','verified');

  SELECT COUNT(*) INTO v_missing FROM milestone_required_deliverables r
    JOIN milestones m ON m.milestone_id = r.milestone_id
   WHERE m.project_id = p_project_id AND m.due_date <= CURRENT_DATE + 7 AND m.status <> 'approved'
     AND NOT EXISTS (SELECT 1 FROM deliverables d WHERE d.milestone_id = m.milestone_id
                       AND d.deliverable_type = r.deliverable_type AND d.status IN ('submitted','accepted'));

  SELECT COUNT(*), COUNT(*) FILTER (WHERE f.due_date < CURRENT_DATE) INTO v_open_fb, v_overdue_fb
    FROM feedback_items f JOIN reviews rv ON rv.review_id = f.review_id
    JOIN milestones m ON m.milestone_id = rv.milestone_id
   WHERE m.project_id = p_project_id AND f.resolution_status <> 'verified';

  SELECT GREATEST(
     COALESCE((SELECT MAX(t.updated_at) FROM tasks t JOIN milestones m ON m.milestone_id = t.milestone_id
                WHERE m.project_id = p_project_id), '-infinity'::timestamptz),
     COALESCE((SELECT MAX(dv.uploaded_at) FROM document_versions dv
                JOIN deliverables d ON d.deliverable_id = dv.deliverable_id
                JOIN milestones m ON m.milestone_id = d.milestone_id
                WHERE m.project_id = p_project_id), '-infinity'::timestamptz),
     COALESCE((SELECT MAX(ce.created_at) FROM contribution_evidence ce
                WHERE ce.project_id = p_project_id), '-infinity'::timestamptz))
    INTO v_last_activity;
  v_idle_days := CASE WHEN v_last_activity = '-infinity'::timestamptz THEN 30
                      ELSE CURRENT_DATE - v_last_activity::date END;

  SELECT COUNT(*) INTO v_members FROM team_members tm JOIN projects p ON p.team_id = tm.team_id
   WHERE p.project_id = p_project_id;
  SELECT COALESCE(SUM(cs.evidence_points), 0), COALESCE(MAX(cs.evidence_points), 0)
    INTO v_total_pts, v_max_pts FROM v_contribution_summary cs WHERE cs.project_id = p_project_id;

  -- Points per factor (max 25 + 20 + 20 + 15 + 10 + 10 = 100)
  pts_ms    := LEAST(25, v_overdue_ms * 12.5);
  pts_tasks := LEAST(20, v_overdue_tasks * 4);
  pts_docs  := LEAST(20, v_missing * 10);
  pts_fb    := LEAST(15, v_open_fb * 3 + v_overdue_fb * 2);
  pts_idle  := CASE WHEN v_idle_days <= 5 THEN 0 WHEN v_idle_days <= 10 THEN 5 ELSE 10 END;
  pts_imb   := CASE WHEN v_members >= 2 AND v_total_pts >= 5
                    THEN ROUND(10 * GREATEST(0, (v_max_pts / v_total_pts - 1.0 / v_members)
                                              / (1 - 1.0 / v_members)), 2)
                    ELSE 0 END;
  v_total := LEAST(100, pts_ms + pts_tasks + pts_docs + pts_fb + pts_idle + pts_imb);
  v_level := CASE WHEN v_total < 25 THEN 'low' WHEN v_total < 50 THEN 'moderate'
                  WHEN v_total < 75 THEN 'high' ELSE 'critical' END;

  IF v_overdue_ms   > 0 THEN v_reasons := v_reasons || format('%s milestone(s) overdue (+%s)', v_overdue_ms, pts_ms); END IF;
  IF v_overdue_tasks> 0 THEN v_reasons := v_reasons || format('%s task(s) overdue (+%s)', v_overdue_tasks, pts_tasks); END IF;
  IF v_missing      > 0 THEN v_reasons := v_reasons || format('%s mandatory deliverable(s) missing (+%s)', v_missing, pts_docs); END IF;
  IF v_open_fb      > 0 THEN v_reasons := v_reasons || format('%s unresolved feedback item(s), %s overdue (+%s)', v_open_fb, v_overdue_fb, pts_fb); END IF;
  IF pts_idle       > 0 THEN v_reasons := v_reasons || format('no recorded activity for %s days (+%s)', v_idle_days, pts_idle); END IF;
  IF pts_imb        > 0 THEN v_reasons := v_reasons || format('uneven contribution across members (+%s)', pts_imb); END IF;

  RETURN QUERY SELECT v_total, v_level,
      COALESCE(NULLIF(array_to_string(v_reasons, '; '), ''), 'No risk factors detected'),
      jsonb_build_object('overdue_milestones', pts_ms, 'overdue_tasks', pts_tasks,
                         'missing_deliverables', pts_docs, 'unresolved_feedback', pts_fb,
                         'inactivity', pts_idle, 'contribution_imbalance', pts_imb);
END $$;

-- Flag overdue milestones (time-based; Postgres cannot fire a trigger just because time passed,
-- so this runs from the sweep job and from the milestone trigger).
CREATE OR REPLACE FUNCTION fn_flag_overdue_milestones() RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
  INSERT INTO risk_events(project_id, milestone_id, event_type, details)
  SELECT m.project_id, m.milestone_id, 'milestone_overdue',
         format('Milestone "%s" was due on %s', m.title, m.due_date)
  FROM milestones m JOIN projects p ON p.project_id = m.project_id
  WHERE m.due_date < CURRENT_DATE AND m.status <> 'approved' AND p.status IN ('approved','in_progress')
  ON CONFLICT DO NOTHING;                       -- uq_open_risk_event prevents duplicates
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE risk_events e SET resolved_at = now()
    FROM milestones m
   WHERE e.milestone_id = m.milestone_id AND e.event_type = 'milestone_overdue'
     AND e.resolved_at IS NULL AND m.status = 'approved';
  RETURN v_count;
END $$;

-- Store a new risk snapshot for one project (called by API, sweep script and after key events)
CREATE OR REPLACE PROCEDURE sp_recalculate_risk(p_project_id INT)
LANGUAGE plpgsql AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM fn_calculate_project_risk(p_project_id);
  INSERT INTO risk_assessments(project_id, risk_score, risk_level, reason, breakdown)
  VALUES (p_project_id, r.risk_score, r.risk_level, r.reason, r.breakdown);
END $$;

-- Recalculate every active project. The Node sweep script instead loops over project ids and
-- calls sp_recalculate_risk one by one so it can draw a progress bar.
CREATE OR REPLACE PROCEDURE sp_run_risk_sweep()
LANGUAGE plpgsql AS $$
DECLARE v_id INT;
BEGIN
  PERFORM fn_flag_overdue_milestones();
  FOR v_id IN SELECT project_id FROM projects WHERE status IN ('approved','in_progress') LOOP
    CALL sp_recalculate_risk(v_id);
  END LOOP;
END $$;
