-- 012_drop_demo.sql  -- safe development clean-up (DROP)
SET search_path = projectpulse, public;

-- A temporary index and view created while experimenting are now obsolete.
CREATE INDEX IF NOT EXISTS idx_tmp_tasks_title ON tasks(title);       -- created only to be dropped
CREATE VIEW v_tmp_task_list AS SELECT task_id, title FROM tasks;      -- created only to be dropped
DROP VIEW  IF EXISTS v_tmp_task_list;
DROP INDEX IF EXISTS idx_tmp_tasks_title;

ALTER TABLE git_activities ADD COLUMN tmp_notes TEXT;
ALTER TABLE git_activities DROP COLUMN tmp_notes;                      -- temporary column removed
-- Safe because nothing depends on these objects (see docs/DECISIONS.md D-07).
