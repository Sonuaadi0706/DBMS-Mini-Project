-- 011_alter_demo.sql  -- documented schema change (ALTER)
SET search_path = projectpulse, public;

-- Why: some milestones need one specific kind of evidence attached before a guide may approve them.
ALTER TABLE milestones
  ADD COLUMN required_evidence_type VARCHAR(30)
  CHECK (required_evidence_type IS NULL OR required_evidence_type IN
        ('proposal','srs','design_doc','source_code','screenshot','test_report','presentation','final_report','other'));

-- Why: guards against typos such as 4000 hours instead of 40.
ALTER TABLE tasks ADD CONSTRAINT chk_task_effort_max CHECK (effort_hours <= 200);

-- Why: make the "no technologies listed" default explicit.
ALTER TABLE projects ALTER COLUMN technologies SET DEFAULT '{}';

-- The approval guard now also honours required_evidence_type.
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
    IF NEW.required_evidence_type IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM deliverables d WHERE d.milestone_id = NEW.milestone_id
            AND d.deliverable_type = NEW.required_evidence_type
            AND d.status IN ('submitted','accepted')) THEN
      RAISE EXCEPTION 'Cannot approve milestone %: required evidence of type % is missing',
        NEW.milestone_id, NEW.required_evidence_type USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
