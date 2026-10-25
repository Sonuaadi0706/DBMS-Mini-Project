-- 010_triggers.sql
-- Rules that must hold no matter which client writes the data live here.
-- The API sets `SET LOCAL app.current_user_id` so audit rows name the right person.
SET search_path = projectpulse, public;

-- ---------------------------------------------------------------------------------------------
-- Workflow transition guard: a status may only change along an edge listed in status_transitions.
-- Usage: EXECUTE FUNCTION fn_validate_transition('<status column>', '<entity_type>')
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_col TEXT := TG_ARGV[0]; v_entity TEXT := TG_ARGV[1]; v_old TEXT; v_new TEXT;
BEGIN
  v_old := to_jsonb(OLD) ->> v_col;
  v_new := to_jsonb(NEW) ->> v_col;
  IF v_old IS DISTINCT FROM v_new AND NOT EXISTS (
       SELECT 1 FROM status_transitions
        WHERE entity_type = v_entity AND from_status = v_old AND to_status = v_new) THEN
    RAISE EXCEPTION 'Invalid % status change: % -> %', v_entity, v_old, v_new
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_projects_transition BEFORE UPDATE OF status ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('status','project');
CREATE TRIGGER trg_milestones_transition BEFORE UPDATE OF status ON milestones
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('status','milestone');
CREATE TRIGGER trg_tasks_transition BEFORE UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('status','task');
CREATE TRIGGER trg_feedback_transition BEFORE UPDATE OF resolution_status ON feedback_items
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('resolution_status','feedback');
CREATE TRIGGER trg_deliverables_transition BEFORE UPDATE OF status ON deliverables
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('status','deliverable');
CREATE TRIGGER trg_similarity_transition BEFORE UPDATE OF faculty_decision ON similarity_reviews
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('faculty_decision','similarity');

-- ---------------------------------------------------------------------------------------------
-- Audit of status changes. Usage: fn_audit_status_change('<pk column>','<status column>')
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_status_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_user INT := NULLIF(current_setting('app.current_user_id', true), '')::INT;
  v_pk TEXT := to_jsonb(NEW) ->> TG_ARGV[0];
  v_old TEXT := to_jsonb(OLD) ->> TG_ARGV[1];
  v_new TEXT := to_jsonb(NEW) ->> TG_ARGV[1];
BEGIN
  IF v_old IS DISTINCT FROM v_new THEN
    INSERT INTO audit_logs(user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (v_user, 'STATUS_CHANGE', TG_TABLE_NAME, v_pk,
            jsonb_build_object(TG_ARGV[1], v_old), jsonb_build_object(TG_ARGV[1], v_new));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_projects_audit AFTER UPDATE OF status ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_audit_status_change('project_id','status');
CREATE TRIGGER trg_milestones_audit AFTER UPDATE OF status ON milestones
  FOR EACH ROW EXECUTE FUNCTION fn_audit_status_change('milestone_id','status');
CREATE TRIGGER trg_tasks_audit AFTER UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_audit_status_change('task_id','status');
CREATE TRIGGER trg_feedback_audit AFTER UPDATE OF resolution_status ON feedback_items
  FOR EACH ROW EXECUTE FUNCTION fn_audit_status_change('feedback_id','resolution_status');
CREATE TRIGGER trg_deliverables_audit AFTER UPDATE OF status ON deliverables
  FOR EACH ROW EXECUTE FUNCTION fn_audit_status_change('deliverable_id','status');
CREATE TRIGGER trg_similarity_audit AFTER UPDATE OF faculty_decision ON similarity_reviews
  FOR EACH ROW EXECUTE FUNCTION fn_audit_status_change('similarity_id','faculty_decision');
CREATE TRIGGER trg_reviews_audit AFTER UPDATE OF decision ON reviews
  FOR EACH ROW EXECUTE FUNCTION fn_audit_status_change('review_id','decision');

-- Generic row audit (INSERT/UPDATE/DELETE with old/new JSON). Arg 0 = column used as entity_id.
CREATE OR REPLACE FUNCTION fn_audit_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_user INT := NULLIF(current_setting('app.current_user_id', true), '')::INT;
  v_old JSONB; v_new JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
  ELSE v_old := to_jsonb(OLD); END IF;
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (v_user, TG_OP, TG_TABLE_NAME, COALESCE(v_new, v_old) ->> TG_ARGV[0], v_old, v_new);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_deliverables_row_audit AFTER INSERT OR UPDATE OR DELETE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row('deliverable_id');
CREATE TRIGGER trg_task_assign_audit AFTER INSERT OR DELETE ON task_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row('task_id');
CREATE TRIGGER trg_user_roles_audit AFTER INSERT OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row('user_id');
CREATE TRIGGER trg_guide_alloc_audit AFTER INSERT OR UPDATE OR DELETE ON guide_allocations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row('allocation_id');
CREATE TRIGGER trg_team_members_audit AFTER INSERT OR UPDATE OR DELETE ON team_members
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row('team_id');
CREATE TRIGGER trg_tasks_row_audit AFTER INSERT OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row('task_id');

-- ---------------------------------------------------------------------------------------------
-- Immutability: proposal decisions and the audit log are append-only.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_block_modify_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP;
END $$;
CREATE TRIGGER trg_proposal_actions_immutable BEFORE UPDATE OR DELETE ON proposal_actions
  FOR EACH ROW EXECUTE FUNCTION fn_block_modify_immutable();
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_block_modify_immutable();

-- ---------------------------------------------------------------------------------------------
-- Milestone weightage total <= 100 per project. Deferred so a transaction may insert all
-- milestones and the total is checked once at COMMIT.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_weightage_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(weightage), 0) INTO v_total FROM milestones WHERE project_id = NEW.project_id;
  IF v_total > 100 THEN
    RAISE EXCEPTION 'Total milestone weightage for project % is % (max 100)', NEW.project_id, v_total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_milestone_weightage AFTER INSERT OR UPDATE OF weightage ON milestones
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_check_weightage_total();

-- ---------------------------------------------------------------------------------------------
-- Membership / allocation / assignment integrity (cross-table rules CHECK cannot express)
-- ---------------------------------------------------------------------------------------------
-- Only users holding the student role may join a team, and staff allocated to a team's project
-- may not also be members of that team.
CREATE OR REPLACE FUNCTION fn_check_team_member_is_student() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
                  WHERE ur.user_id = NEW.user_id AND r.role_name = 'student') THEN
    RAISE EXCEPTION 'User % does not hold the student role and cannot join a team', NEW.user_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM guide_allocations ga JOIN projects p ON p.project_id = ga.project_id
              WHERE p.team_id = NEW.team_id AND ga.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'User % is a guide/reviewer of this team and cannot also be a member', NEW.user_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_team_member_student BEFORE INSERT OR UPDATE OF user_id ON team_members
  FOR EACH ROW EXECUTE FUNCTION fn_check_team_member_is_student();

-- A guide must hold faculty_guide, a reviewer must hold reviewer, and neither may belong to the
-- team that owns the project.
CREATE OR REPLACE FUNCTION fn_check_allocation_role() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_needed TEXT := CASE NEW.allocation_role WHEN 'guide' THEN 'faculty_guide' ELSE 'reviewer' END;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
                  WHERE ur.user_id = NEW.user_id AND r.role_name = v_needed) THEN
    RAISE EXCEPTION 'User % does not hold the % role required for allocation as %',
      NEW.user_id, v_needed, NEW.allocation_role USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM projects p JOIN team_members tm ON tm.team_id = p.team_id
              WHERE p.project_id = NEW.project_id AND tm.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'User % is a member of the project team and cannot be its %',
      NEW.user_id, NEW.allocation_role USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guide_alloc_role BEFORE INSERT OR UPDATE OF user_id, allocation_role ON guide_allocations
  FOR EACH ROW EXECUTE FUNCTION fn_check_allocation_role();

-- Task assignees and feedback assignees must belong to the project's team.
CREATE OR REPLACE FUNCTION fn_check_assignee_in_team() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_user INT; v_project INT;
BEGIN
  IF TG_TABLE_NAME = 'task_assignments' THEN
    v_user := NEW.user_id;
    SELECT m.project_id INTO v_project FROM tasks t JOIN milestones m ON m.milestone_id = t.milestone_id
     WHERE t.task_id = NEW.task_id;
  ELSE  -- feedback_items
    v_user := NEW.assigned_user_id;
    SELECT m.project_id INTO v_project FROM reviews r JOIN milestones m ON m.milestone_id = r.milestone_id
     WHERE r.review_id = NEW.review_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM projects p JOIN team_members tm ON tm.team_id = p.team_id
                  WHERE p.project_id = v_project AND tm.user_id = v_user) THEN
    RAISE EXCEPTION 'User % is not a member of the team that owns project %', v_user, v_project
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_task_assign_member BEFORE INSERT OR UPDATE OF user_id ON task_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_check_assignee_in_team();
CREATE TRIGGER trg_feedback_assignee_member BEFORE INSERT OR UPDATE OF assigned_user_id ON feedback_items
  FOR EACH ROW EXECUTE FUNCTION fn_check_assignee_in_team();

-- ---------------------------------------------------------------------------------------------
-- Auto version numbers (omit version_number in the INSERT and it becomes max + 1).
-- NOT NULL is checked after BEFORE triggers run, so omitting the column works.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_auto_version_number() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO NEW.version_number
      FROM document_versions WHERE deliverable_id = NEW.deliverable_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_docver_number BEFORE INSERT ON document_versions
  FOR EACH ROW EXECUTE FUNCTION fn_auto_version_number();

-- ---------------------------------------------------------------------------------------------
-- Overdue milestone -> risk event (the proposal's required trigger)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_milestone_overdue_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.due_date < CURRENT_DATE AND NEW.status <> 'approved' THEN
    INSERT INTO risk_events(project_id, milestone_id, event_type, details)
    VALUES (NEW.project_id, NEW.milestone_id, 'milestone_overdue',
            format('Milestone "%s" was due on %s', NEW.title, NEW.due_date))
    ON CONFLICT DO NOTHING;
  ELSIF NEW.status = 'approved' THEN
    UPDATE risk_events SET resolved_at = now()
     WHERE milestone_id = NEW.milestone_id AND event_type = 'milestone_overdue' AND resolved_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_milestone_overdue AFTER INSERT OR UPDATE OF due_date, status ON milestones
  FOR EACH ROW EXECUTE FUNCTION fn_milestone_overdue_event();

-- A milestone cannot be approved while a mandatory deliverable type has no submitted/accepted
-- deliverable. (Migration 011 replaces this function to also honour required_evidence_type.)
CREATE OR REPLACE FUNCTION fn_block_approval_without_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_missing TEXT;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    SELECT string_agg(r.deliverable_type, ', ') INTO v_missing
      FROM milestone_required_deliverables r
     WHERE r.milestone_id = NEW.milestone_id
       AND NOT EXISTS (SELECT 1 FROM deliverables d WHERE d.milestone_id = r.milestone_id
                         AND d.deliverable_type = r.deliverable_type
                         AND d.status IN ('submitted','accepted'));
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot approve milestone %: mandatory deliverable(s) missing: %',
        NEW.milestone_id, v_missing USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_milestone_block_approval BEFORE UPDATE OF status ON milestones
  FOR EACH ROW EXECUTE FUNCTION fn_block_approval_without_evidence();

-- ---------------------------------------------------------------------------------------------
-- Task side effects + automatic contribution evidence
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_task_side_effects() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('done','verified') AND NEW.actual_completion_date IS NULL THEN
    NEW.actual_completion_date := CURRENT_DATE;
  ELSIF NEW.status NOT IN ('done','verified') THEN
    NEW.actual_completion_date := NULL; NEW.verified_by := NULL; NEW.verified_at := NULL;
  END IF;
  IF NEW.status = 'verified' AND NEW.verified_at IS NULL THEN NEW.verified_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_tasks_side_effects BEFORE UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_task_side_effects();

-- Verified task -> verified evidence for every assignee (bigger task, more weight).
CREATE OR REPLACE FUNCTION fn_evidence_from_task() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified' THEN
    INSERT INTO contribution_evidence(project_id, user_id, task_id, evidence_type, description,
                                      weight, verified_flag, verified_by, verified_at, source_table, source_id)
    SELECT m.project_id, ta.user_id, NEW.task_id, 'task_completed',
           'Verified task: ' || NEW.title,
           LEAST(10, GREATEST(1, ROUND(NEW.effort_hours / 4.0, 2))),
           TRUE, NEW.verified_by, NEW.verified_at, 'tasks', NEW.task_id
      FROM task_assignments ta JOIN milestones m ON m.milestone_id = NEW.milestone_id
     WHERE ta.task_id = NEW.task_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_task_evidence AFTER UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_evidence_from_task();

-- New document version -> UNVERIFIED evidence for the uploader (guide verifies later).
CREATE OR REPLACE FUNCTION fn_evidence_from_docversion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_project INT; v_title TEXT;
BEGIN
  SELECT m.project_id, d.title INTO v_project, v_title
    FROM deliverables d JOIN milestones m ON m.milestone_id = d.milestone_id
   WHERE d.deliverable_id = NEW.deliverable_id;
  INSERT INTO contribution_evidence(project_id, user_id, evidence_type, description,
                                    source_table, source_id)
  VALUES (v_project, NEW.uploaded_by, 'document_upload',
          left(format('Uploaded v%s of %s', NEW.version_number, v_title), 300),
          'document_versions', NEW.version_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_docver_evidence AFTER INSERT ON document_versions
  FOR EACH ROW EXECUTE FUNCTION fn_evidence_from_docversion();

-- Feedback resolved -> unverified evidence; feedback verified -> that evidence becomes verified.
CREATE OR REPLACE FUNCTION fn_evidence_from_feedback() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_project INT;
BEGIN
  SELECT m.project_id INTO v_project FROM reviews r JOIN milestones m ON m.milestone_id = r.milestone_id
   WHERE r.review_id = NEW.review_id;
  IF NEW.resolution_status = 'resolved' AND OLD.resolution_status IS DISTINCT FROM 'resolved' THEN
    INSERT INTO contribution_evidence(project_id, user_id, evidence_type, description,
                                      source_table, source_id)
    VALUES (v_project, NEW.assigned_user_id, 'feedback_resolved',
            left('Resolved feedback: ' || NEW.description, 300), 'feedback_items', NEW.feedback_id)
    ON CONFLICT DO NOTHING;
  ELSIF NEW.resolution_status = 'verified' AND OLD.resolution_status IS DISTINCT FROM 'verified' THEN
    UPDATE contribution_evidence
       SET verified_flag = TRUE, verified_by = NEW.verified_by, verified_at = NEW.verified_at
     WHERE source_table = 'feedback_items' AND source_id = NEW.feedback_id
       AND user_id = NEW.assigned_user_id AND evidence_type = 'feedback_resolved';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_feedback_evidence AFTER UPDATE OF resolution_status ON feedback_items
  FOR EACH ROW EXECUTE FUNCTION fn_evidence_from_feedback();
