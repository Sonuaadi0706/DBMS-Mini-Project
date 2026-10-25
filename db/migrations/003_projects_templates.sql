-- 003_projects_templates.sql
SET search_path = projectpulse, public;

CREATE TABLE project_templates (
  template_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id    INT REFERENCES courses(course_id) ON DELETE SET NULL,
  name         VARCHAR(120) NOT NULL UNIQUE,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_milestones (
  template_milestone_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id            INT NOT NULL REFERENCES project_templates(template_id) ON DELETE CASCADE,
  sequence_no            INT NOT NULL CHECK (sequence_no > 0),
  title                  VARCHAR(150) NOT NULL,
  offset_days            INT NOT NULL CHECK (offset_days >= 0),    -- due date = project start + offset
  weightage              NUMERIC(5,2) NOT NULL CHECK (weightage > 0 AND weightage <= 100),
  required_deliverable_types TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (template_id, sequence_no)
);

CREATE TABLE projects (
  project_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id            INT NOT NULL,
  course_id          INT NOT NULL,
  template_id        INT REFERENCES project_templates(template_id) ON DELETE SET NULL,
  title              VARCHAR(200) NOT NULL CHECK (length(trim(title)) >= 5),
  abstract           TEXT,
  problem_statement  TEXT,
  objectives         TEXT,
  scope              TEXT,
  domain             VARCHAR(80),
  technologies       TEXT[] NOT NULL DEFAULT '{}',
  repo_link          TEXT CHECK (repo_link IS NULL OR repo_link ~* '^https?://'),
  status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','submitted','revision_requested','approved',
                                       'rejected','in_progress','completed','archived')),
  start_date         DATE,
  end_date           DATE,
  created_by         INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  submitted_at       TIMESTAMPTZ,
  approved_by        INT REFERENCES users(user_id) ON DELETE SET NULL,
  approved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (team_id, course_id) REFERENCES teams(team_id, course_id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  -- Drafts may be incomplete; anything beyond draft must have the full proposal text.
  CHECK (status = 'draft' OR (
        abstract IS NOT NULL AND length(abstract) >= 50 AND
        problem_statement IS NOT NULL AND length(problem_statement) >= 30 AND
        objectives IS NOT NULL AND scope IS NOT NULL AND domain IS NOT NULL))
);
-- One ACTIVE project per team (rejected/archived ones do not block a new proposal).
CREATE UNIQUE INDEX uq_projects_active_team ON projects(team_id)
  WHERE status NOT IN ('rejected','archived');
-- No two active proposals in a course with the same title (case-insensitive).
CREATE UNIQUE INDEX uq_projects_course_title ON projects(course_id, lower(title))
  WHERE status NOT IN ('rejected','archived');
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Immutable approval history (UPDATE/DELETE blocked by trigger in migration 010)
CREATE TABLE proposal_actions (
  action_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id   INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  actor_id     INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  action       VARCHAR(20) NOT NULL
               CHECK (action IN ('submit','resubmit','approve','reject','request_revision')),
  from_status  VARCHAR(20) NOT NULL,
  to_status    VARCHAR(20) NOT NULL,
  comments     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- reject / request_revision must carry an explanation
  CHECK (action NOT IN ('reject','request_revision') OR length(trim(coalesce(comments,''))) > 0)
);

CREATE TABLE guide_allocations (
  allocation_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id       INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  user_id          INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  allocation_role  VARCHAR(10) NOT NULL CHECK (allocation_role IN ('guide','reviewer')),
  allocated_by     INT REFERENCES users(user_id) ON DELETE SET NULL,
  allocated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id, allocation_role)
);
CREATE UNIQUE INDEX uq_one_guide_per_project ON guide_allocations(project_id)
  WHERE allocation_role = 'guide';

-- Data-driven workflow: which status changes are legal (used by trigger fn_validate_transition)
CREATE TABLE status_transitions (
  entity_type  VARCHAR(30) NOT NULL,
  from_status  VARCHAR(25) NOT NULL,
  to_status    VARCHAR(25) NOT NULL,
  PRIMARY KEY (entity_type, from_status, to_status)
);
