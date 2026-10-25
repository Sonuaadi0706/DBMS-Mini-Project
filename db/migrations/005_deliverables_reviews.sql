-- 005_deliverables_reviews.sql
SET search_path = projectpulse, public;

CREATE TABLE deliverables (
  deliverable_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  milestone_id      INT NOT NULL REFERENCES milestones(milestone_id) ON DELETE RESTRICT,
  deliverable_type  VARCHAR(30) NOT NULL
                    CHECK (deliverable_type IN ('proposal','srs','design_doc','source_code',
                                'screenshot','test_report','presentation','final_report','other')),
  title             VARCHAR(200) NOT NULL,
  repo_link         TEXT CHECK (repo_link IS NULL OR repo_link ~* '^https?://'),
  evidence_url      TEXT CHECK (evidence_url IS NULL OR evidence_url ~* '^https?://'),
  mongo_doc_id      VARCHAR(40),                       -- _id of the matching MongoDB document
  status            VARCHAR(10) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','submitted','accepted','rejected')),
  submitted_by      INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status = 'draft' OR submitted_at IS NOT NULL)
);
CREATE TRIGGER trg_deliverables_updated BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE document_versions (
  version_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deliverable_id   INT NOT NULL REFERENCES deliverables(deliverable_id) ON DELETE CASCADE,
  version_number   INT NOT NULL CHECK (version_number > 0),
  change_summary   VARCHAR(500) NOT NULL,
  file_name        VARCHAR(255),
  file_url         TEXT,                                -- secure internal path or external link
  file_size_bytes  BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  checksum_sha256  CHAR(64),
  uploaded_by      INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deliverable_id, version_number),
  CHECK (file_url IS NOT NULL OR file_name IS NOT NULL)
);

CREATE TABLE reviews (
  review_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  milestone_id  INT NOT NULL REFERENCES milestones(milestone_id) ON DELETE RESTRICT,
  reviewer_id   INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  review_type   VARCHAR(10) NOT NULL DEFAULT 'milestone' CHECK (review_type IN ('milestone','final')),
  decision      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (decision IN ('pending','approved','revision_requested','rejected')),
  comments      TEXT,
  total_score   NUMERIC(5,2) CHECK (total_score IS NULL OR (total_score >= 0 AND total_score <= 100)),
  review_date   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision = 'pending' OR review_date IS NOT NULL)
);

CREATE TABLE review_scores (
  review_id   INT NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
  criterion   VARCHAR(80) NOT NULL,
  max_score   NUMERIC(5,2) NOT NULL CHECK (max_score > 0),
  score       NUMERIC(5,2) NOT NULL CHECK (score >= 0),
  PRIMARY KEY (review_id, criterion),
  CHECK (score <= max_score)
);

CREATE TABLE feedback_items (
  feedback_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  review_id          INT NOT NULL REFERENCES reviews(review_id) ON DELETE RESTRICT,
  created_by         INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,   -- faculty/reviewer
  assigned_user_id   INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,   -- student who must resolve
  description        TEXT NOT NULL CHECK (length(trim(description)) > 0),
  severity           VARCHAR(8) NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','major','critical')),
  resolution_status  VARCHAR(12) NOT NULL DEFAULT 'open'
                     CHECK (resolution_status IN ('open','in_progress','resolved','verified','reopened')),
  response_text      TEXT,
  due_date           DATE,
  resolved_at        TIMESTAMPTZ,
  verified_by        INT REFERENCES users(user_id) ON DELETE SET NULL,
  verified_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (resolution_status NOT IN ('resolved','verified') OR resolved_at IS NOT NULL),
  CHECK (resolution_status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TRIGGER trg_feedback_updated BEFORE UPDATE ON feedback_items
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
