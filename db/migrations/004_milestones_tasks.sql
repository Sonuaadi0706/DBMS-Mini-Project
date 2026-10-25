-- 004_milestones_tasks.sql
SET search_path = projectpulse, public;

CREATE TABLE milestones (
  milestone_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id         INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  sequence_no        INT NOT NULL CHECK (sequence_no > 0),
  title              VARCHAR(150) NOT NULL,
  description        TEXT,
  start_date         DATE,
  due_date           DATE NOT NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'planned'
                     CHECK (status IN ('planned','in_progress','submitted','under_review',
                                       'approved','revision_requested','rejected')),
  weightage          NUMERIC(5,2) NOT NULL CHECK (weightage > 0 AND weightage <= 100),
  submitted_at       TIMESTAMPTZ,
  approved_by        INT REFERENCES users(user_id) ON DELETE SET NULL,
  approved_at        TIMESTAMPTZ,
  approval_comments  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, sequence_no),
  CHECK (start_date IS NULL OR due_date >= start_date),
  CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
-- (Total weightage per project <= 100 is enforced by a constraint trigger in migration 010.)
CREATE TRIGGER trg_milestones_updated BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Mandatory deliverable types for each milestone (used for "missing deliverable" detection)
CREATE TABLE milestone_required_deliverables (
  milestone_id      INT NOT NULL REFERENCES milestones(milestone_id) ON DELETE CASCADE,
  deliverable_type  VARCHAR(30) NOT NULL
                    CHECK (deliverable_type IN ('proposal','srs','design_doc','source_code',
                                'screenshot','test_report','presentation','final_report','other')),
  PRIMARY KEY (milestone_id, deliverable_type)
);

CREATE TABLE tasks (
  task_id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  milestone_id             INT NOT NULL REFERENCES milestones(milestone_id) ON DELETE RESTRICT,
  title                    VARCHAR(150) NOT NULL,
  description              TEXT,
  status                   VARCHAR(12) NOT NULL DEFAULT 'todo'
                           CHECK (status IN ('todo','in_progress','blocked','done','verified')),
  priority                 VARCHAR(8) NOT NULL DEFAULT 'medium'
                           CHECK (priority IN ('low','medium','high')),
  effort_hours             NUMERIC(6,2) NOT NULL DEFAULT 1 CHECK (effort_hours > 0),
  planned_start_date       DATE,
  planned_completion_date  DATE NOT NULL,
  actual_completion_date   DATE,
  due_date                 DATE NOT NULL,
  verified_by              INT REFERENCES users(user_id) ON DELETE SET NULL,
  verified_at              TIMESTAMPTZ,
  created_by               INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (planned_start_date IS NULL OR planned_completion_date >= planned_start_date),
  CHECK (due_date >= COALESCE(planned_start_date, due_date)),
  CHECK (actual_completion_date IS NULL OR status IN ('done','verified')),
  CHECK (status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE task_assignments (
  task_id          INT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  user_id          INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  assignment_type  VARCHAR(12) NOT NULL DEFAULT 'owner' CHECK (assignment_type IN ('owner','collaborator')),
  assigned_by      INT REFERENCES users(user_id) ON DELETE SET NULL,
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE UNIQUE INDEX uq_one_owner_per_task ON task_assignments(task_id)
  WHERE assignment_type = 'owner';
