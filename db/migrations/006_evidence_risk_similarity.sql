-- 006_evidence_risk_similarity.sql
SET search_path = projectpulse, public;

CREATE TABLE git_activities (
  git_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id      INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  task_id         INT REFERENCES tasks(task_id) ON DELETE SET NULL,
  user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  repo_url        TEXT NOT NULL CHECK (repo_url ~* '^https?://'),
  commit_ref      VARCHAR(64) NOT NULL,
  commit_message  VARCHAR(300),
  committed_at    TIMESTAMPTZ,
  recorded_by     INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_url, commit_ref)
);

CREATE TABLE contribution_evidence (
  evidence_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id     INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  task_id        INT REFERENCES tasks(task_id) ON DELETE SET NULL,
  evidence_type  VARCHAR(25) NOT NULL
                 CHECK (evidence_type IN ('task_completed','document_upload','feedback_resolved',
                                          'git_activity','review_participation')),
  description    VARCHAR(300),
  weight         NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 10),
  verified_flag  BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by    INT REFERENCES users(user_id) ON DELETE SET NULL,
  verified_at    TIMESTAMPTZ,
  source_table   VARCHAR(40),            -- which table produced it (tasks, document_versions, ...)
  source_id      INT,                    -- primary key in that table
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT verified_flag OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  UNIQUE (source_table, source_id, user_id, evidence_type)   -- no duplicate auto-evidence
);

CREATE TABLE risk_assessments (
  risk_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id      INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  risk_score      NUMERIC(5,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level      VARCHAR(10) NOT NULL CHECK (risk_level IN ('low','moderate','high','critical')),
  reason          TEXT NOT NULL,                 -- human-readable explanation
  breakdown       JSONB NOT NULL DEFAULT '{}',   -- points per risk factor
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- level must match the score band (24/49/74 thresholds, see spec 9.6)
  CHECK ((risk_level = 'low' AND risk_score < 25) OR
         (risk_level = 'moderate' AND risk_score >= 25 AND risk_score < 50) OR
         (risk_level = 'high' AND risk_score >= 50 AND risk_score < 75) OR
         (risk_level = 'critical' AND risk_score >= 75))
);

CREATE TABLE risk_events (
  event_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id    INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  milestone_id  INT REFERENCES milestones(milestone_id) ON DELETE SET NULL,
  event_type    VARCHAR(30) NOT NULL
                CHECK (event_type IN ('milestone_overdue','task_overdue','feedback_unresolved',
                                      'inactivity','missing_deliverable','contribution_imbalance')),
  details       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);
-- only one OPEN event of the same type per milestone/project
CREATE UNIQUE INDEX uq_open_risk_event ON risk_events(project_id, event_type, COALESCE(milestone_id, 0))
  WHERE resolved_at IS NULL;

CREATE TABLE similarity_reviews (
  similarity_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_project_id    INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  matched_project_id   INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  similarity_score     NUMERIC(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  matched_section      VARCHAR(20),
  source_excerpt       TEXT,
  matched_excerpt      TEXT,
  faculty_decision     VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (faculty_decision IN ('pending','not_similar','acceptable_overlap',
                                                   'needs_revision','escalated')),
  comments             TEXT,
  reviewed_by          INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at           TIMESTAMPTZ,
  CHECK (source_project_id <> matched_project_id),
  CHECK (faculty_decision = 'pending' OR (reviewed_by IS NOT NULL AND decided_at IS NOT NULL)),
  UNIQUE (source_project_id, matched_project_id)
);

-- pgvector table (vector database component)
CREATE TABLE project_embeddings (
  embedding_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id    INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  course_id     INT NOT NULL REFERENCES courses(course_id) ON DELETE RESTRICT,  -- for metadata filtering
  section_type  VARCHAR(20) NOT NULL
                CHECK (section_type IN ('title','abstract','problem_statement','objectives',
                                        'scope','document_chunk')),
  chunk_index   INT NOT NULL DEFAULT 0 CHECK (chunk_index >= 0),
  chunk_text    TEXT NOT NULL,
  embedding     vector(384) NOT NULL,
  model_name    VARCHAR(80) NOT NULL,
  is_current    BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE for superseded/rejected content
  access_level  VARCHAR(10) NOT NULL DEFAULT 'faculty' CHECK (access_level IN ('faculty','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, section_type, chunk_index, model_name)
);

CREATE TABLE peer_evaluations (
  evaluation_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id     INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  milestone_id   INT REFERENCES milestones(milestone_id) ON DELETE SET NULL,  -- evaluation period
  evaluator_id   INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  evaluatee_id   INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  score          NUMERIC(3,1) NOT NULL CHECK (score >= 1 AND score <= 5),
  comments       VARCHAR(500),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (evaluator_id <> evaluatee_id),
  UNIQUE (project_id, milestone_id, evaluator_id, evaluatee_id)
);

CREATE TABLE audit_logs (
  log_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      INT REFERENCES users(user_id) ON DELETE SET NULL,
  action       VARCHAR(30) NOT NULL,        -- INSERT / UPDATE / DELETE / STATUS_CHANGE / DECISION ...
  entity_type  VARCHAR(40) NOT NULL,
  entity_id    VARCHAR(40),
  old_values   JSONB,
  new_values   JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (   -- P2
  notification_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type             VARCHAR(30) NOT NULL,
  message          VARCHAR(300) NOT NULL,
  link             VARCHAR(200),
  is_read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
