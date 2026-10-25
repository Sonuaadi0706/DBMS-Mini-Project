# Relational schema

_Generated from the live catalogue. Notation: <u>underlined</u> = primary key, *italic* = foreign key (arrow gives the referenced table). Unique keys and CHECK rules are in the data dictionary._

**audit_logs** (<u>log_id</u>, *user_id*→users, action, entity_type, entity_id, old_values, new_values, created_at)

**contribution_evidence** (<u>evidence_id</u>, *project_id*→projects, *user_id*→users, *task_id*→tasks, evidence_type, description, weight, verified_flag, *verified_by*→users, verified_at, source_table, source_id, created_at)

**courses** (<u>course_id</u>, *dept_id*→departments, course_code, course_name, semester, academic_year, is_active, created_at)

**deliverables** (<u>deliverable_id</u>, *milestone_id*→milestones, deliverable_type, title, repo_link, evidence_url, mongo_doc_id, status, *submitted_by*→users, submitted_at, created_at, updated_at)

**departments** (<u>dept_id</u>, dept_code, dept_name, created_at)

**document_versions** (<u>version_id</u>, *deliverable_id*→deliverables, version_number, change_summary, file_name, file_url, file_size_bytes, checksum_sha256, *uploaded_by*→users, uploaded_at)

**feedback_items** (<u>feedback_id</u>, *review_id*→reviews, *created_by*→users, *assigned_user_id*→users, description, severity, resolution_status, response_text, due_date, resolved_at, *verified_by*→users, verified_at, created_at, updated_at)

**git_activities** (<u>git_id</u>, *project_id*→projects, *task_id*→tasks, *user_id*→users, repo_url, commit_ref, commit_message, committed_at, *recorded_by*→users, created_at)

**guide_allocations** (<u>allocation_id</u>, *project_id*→projects, *user_id*→users, allocation_role, *allocated_by*→users, allocated_at)

**milestone_required_deliverables** (*<u>milestone_id</u>*→milestones, <u>deliverable_type</u>)

**milestones** (<u>milestone_id</u>, *project_id*→projects, sequence_no, title, description, start_date, due_date, status, weightage, submitted_at, *approved_by*→users, approved_at, approval_comments, created_at, updated_at, required_evidence_type)

**notifications** (<u>notification_id</u>, *user_id*→users, type, message, link, is_read, created_at)

**peer_evaluations** (<u>evaluation_id</u>, *project_id*→projects, *milestone_id*→milestones, *evaluator_id*→users, *evaluatee_id*→users, score, comments, created_at)

**project_embeddings** (<u>embedding_id</u>, *project_id*→projects, *course_id*→courses, section_type, chunk_index, chunk_text, embedding, model_name, is_current, access_level, created_at)

**project_templates** (<u>template_id</u>, *course_id*→courses, name, description, is_active, *created_by*→users, created_at)

**projects** (<u>project_id</u>, *team_id*→teams, *course_id*→teams, *template_id*→project_templates, title, abstract, problem_statement, objectives, scope, domain, technologies, repo_link, status, start_date, end_date, *created_by*→users, submitted_at, *approved_by*→users, approved_at, created_at, updated_at)

**proposal_actions** (<u>action_id</u>, *project_id*→projects, *actor_id*→users, action, from_status, to_status, comments, created_at)

**review_scores** (*<u>review_id</u>*→reviews, <u>criterion</u>, max_score, score)

**reviews** (<u>review_id</u>, *milestone_id*→milestones, *reviewer_id*→users, review_type, decision, comments, total_score, review_date, created_at)

**risk_assessments** (<u>risk_id</u>, *project_id*→projects, risk_score, risk_level, reason, breakdown, calculated_at)

**risk_events** (<u>event_id</u>, *project_id*→projects, *milestone_id*→milestones, event_type, details, created_at, resolved_at)

**roles** (<u>role_id</u>, role_name, description)

**similarity_reviews** (<u>similarity_id</u>, *source_project_id*→projects, *matched_project_id*→projects, similarity_score, matched_section, source_excerpt, matched_excerpt, faculty_decision, comments, *reviewed_by*→users, created_at, decided_at)

**status_transitions** (<u>entity_type</u>, <u>from_status</u>, <u>to_status</u>)

**task_assignments** (*<u>task_id</u>*→tasks, *<u>user_id</u>*→users, assignment_type, *assigned_by*→users, assigned_at)

**tasks** (<u>task_id</u>, *milestone_id*→milestones, title, description, status, priority, effort_hours, planned_start_date, planned_completion_date, actual_completion_date, due_date, *verified_by*→users, verified_at, *created_by*→users, created_at, updated_at)

**team_members** (*<u>team_id</u>*→teams, *course_id*→teams, *<u>user_id</u>*→users, member_role, responsibility, joined_at)

**teams** (<u>team_id</u>, *course_id*→courses, team_name, *created_by*→users, created_at)

**template_milestones** (<u>template_milestone_id</u>, *template_id*→project_templates, sequence_no, title, offset_days, weightage, required_deliverable_types)

**user_roles** (*<u>user_id</u>*→users, *<u>role_id</u>*→roles, assigned_at, *assigned_by*→users)

**users** (<u>user_id</u>, name, email, password_hash, status, *dept_id*→departments, identifier, failed_login_count, locked_until, last_login_at, created_at, updated_at)

