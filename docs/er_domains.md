# Entity-relationship diagrams by domain

_Generated from the live catalogue. Tables drawn with all attributes belong to the domain; tables shown with only their key are referenced from another domain. Actor columns such as created_by, approved_by and verified_by (all foreign keys to users) are marked FK in the boxes but not drawn as lines, to keep the pictures readable._

## ER 1. Identity, academic context and teams

Who the users are, the departments and courses they belong to, and how students form teams (one team per student per course).

```mermaid
erDiagram
    users |o--o{ audit_logs : "user_id"
    departments ||--o{ courses : "dept_id"
    teams ||--o{ team_members : "team_id+course_id"
    users ||--o{ team_members : "user_id"
    courses ||--o{ teams : "course_id"
    roles ||--o{ user_roles : "role_id"
    users ||--o{ user_roles : "user_id"
    departments |o--o{ users : "dept_id"
    departments {
        integer dept_id PK
        varchar dept_code UK
        varchar dept_name UK
        timestamptz created_at
    }
    courses {
        integer course_id PK
        integer dept_id FK
        varchar course_code
        varchar course_name
        varchar semester
        varchar academic_year
        boolean is_active
        timestamptz created_at
    }
    users {
        integer user_id PK
        varchar name
        citext email UK
        text password_hash
        varchar status
        integer dept_id FK
        varchar identifier UK
        integer failed_login_count
        timestamptz locked_until
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }
    roles {
        integer role_id PK
        varchar role_name UK
        text description
    }
    user_roles {
        integer user_id PK,FK
        integer role_id PK,FK
        timestamptz assigned_at
        integer assigned_by FK
    }
    teams {
        integer team_id PK
        integer course_id FK
        varchar team_name
        integer created_by FK
        timestamptz created_at
    }
    team_members {
        integer team_id PK,FK
        integer course_id FK
        integer user_id PK,FK
        varchar member_role
        varchar responsibility
        timestamptz joined_at
    }
    audit_logs {
        bigint log_id PK
        integer user_id FK
        varchar action
        varchar entity_type
        varchar entity_id
        jsonb old_values
        jsonb new_values
        timestamptz created_at
    }
```

## ER 2. Projects, allocation and planning

A team owns one active project; guides and reviewers are allocated; milestones and tasks plan the work; templates seed the plan.

```mermaid
erDiagram
    projects ||--o{ guide_allocations : "project_id"
    users ||--o{ guide_allocations : "user_id"
    milestones ||--o{ milestone_required_deliverables : "milestone_id"
    projects ||--o{ milestones : "project_id"
    courses |o--o{ project_templates : "course_id"
    teams ||--o{ projects : "team_id+course_id"
    project_templates |o--o{ projects : "template_id"
    users ||--o{ proposal_actions : "actor_id"
    projects ||--o{ proposal_actions : "project_id"
    tasks ||--o{ task_assignments : "task_id"
    users ||--o{ task_assignments : "user_id"
    milestones ||--o{ tasks : "milestone_id"
    project_templates ||--o{ template_milestones : "template_id"
    projects {
        integer project_id PK
        integer team_id FK
        integer course_id FK
        integer template_id FK
        varchar title
        text abstract
        text problem_statement
        text objectives
        text scope
        varchar domain
        text_array technologies
        text repo_link
        varchar status
        date start_date
        date end_date
        integer created_by FK
        timestamptz submitted_at
        integer approved_by FK
        timestamptz approved_at
        timestamptz created_at
        timestamptz updated_at
    }
    proposal_actions {
        integer action_id PK
        integer project_id FK
        integer actor_id FK
        varchar action
        varchar from_status
        varchar to_status
        text comments
        timestamptz created_at
    }
    guide_allocations {
        integer allocation_id PK
        integer project_id FK
        integer user_id FK
        varchar allocation_role
        integer allocated_by FK
        timestamptz allocated_at
    }
    project_templates {
        integer template_id PK
        integer course_id FK
        varchar name UK
        text description
        boolean is_active
        integer created_by FK
        timestamptz created_at
    }
    template_milestones {
        integer template_milestone_id PK
        integer template_id FK
        integer sequence_no
        varchar title
        integer offset_days
        numeric weightage
        text_array required_deliverable_types
    }
    milestones {
        integer milestone_id PK
        integer project_id FK
        integer sequence_no
        varchar title
        text description
        date start_date
        date due_date
        varchar status
        numeric weightage
        timestamptz submitted_at
        integer approved_by FK
        timestamptz approved_at
        text approval_comments
        timestamptz created_at
        timestamptz updated_at
        varchar required_evidence_type
    }
    milestone_required_deliverables {
        integer milestone_id PK,FK
        varchar deliverable_type PK
    }
    tasks {
        integer task_id PK
        integer milestone_id FK
        varchar title
        text description
        varchar status
        varchar priority
        numeric effort_hours
        date planned_start_date
        date planned_completion_date
        date actual_completion_date
        date due_date
        integer verified_by FK
        timestamptz verified_at
        integer created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    task_assignments {
        integer task_id PK,FK
        integer user_id PK,FK
        varchar assignment_type
        integer assigned_by FK
        timestamptz assigned_at
    }
    users {
        integer user_id PK
    }
    courses {
        integer course_id PK
    }
    teams {
        integer team_id PK
    }
```

## ER 3. Deliverables, review and feedback

Submissions with versions, milestone reviews with rubric scores, and trackable feedback assigned to a student.

```mermaid
erDiagram
    milestones ||--o{ deliverables : "milestone_id"
    deliverables ||--o{ document_versions : "deliverable_id"
    users ||--o{ feedback_items : "assigned_user_id"
    reviews ||--o{ feedback_items : "review_id"
    projects ||--o{ milestones : "project_id"
    reviews ||--o{ review_scores : "review_id"
    milestones ||--o{ reviews : "milestone_id"
    users ||--o{ reviews : "reviewer_id"
    milestones {
        integer milestone_id PK
        integer project_id FK
        integer sequence_no
        varchar title
        text description
        date start_date
        date due_date
        varchar status
        numeric weightage
        timestamptz submitted_at
        integer approved_by FK
        timestamptz approved_at
        text approval_comments
        timestamptz created_at
        timestamptz updated_at
        varchar required_evidence_type
    }
    deliverables {
        integer deliverable_id PK
        integer milestone_id FK
        varchar deliverable_type
        varchar title
        text repo_link
        text evidence_url
        varchar mongo_doc_id
        varchar status
        integer submitted_by FK
        timestamptz submitted_at
        timestamptz created_at
        timestamptz updated_at
    }
    document_versions {
        integer version_id PK
        integer deliverable_id FK
        integer version_number
        varchar change_summary
        varchar file_name
        text file_url
        bigint file_size_bytes
        character checksum_sha256
        integer uploaded_by FK
        timestamptz uploaded_at
    }
    reviews {
        integer review_id PK
        integer milestone_id FK
        integer reviewer_id FK
        varchar review_type
        varchar decision
        text comments
        numeric total_score
        date review_date
        timestamptz created_at
    }
    review_scores {
        integer review_id PK,FK
        varchar criterion PK
        numeric max_score
        numeric score
    }
    feedback_items {
        integer feedback_id PK
        integer review_id FK
        integer created_by FK
        integer assigned_user_id FK
        text description
        varchar severity
        varchar resolution_status
        text response_text
        date due_date
        timestamptz resolved_at
        integer verified_by FK
        timestamptz verified_at
        timestamptz created_at
        timestamptz updated_at
    }
    users {
        integer user_id PK
    }
    projects {
        integer project_id PK
    }
```

## ER 4. Evidence, contribution and risk

Verifiable evidence per student, commit references, peer ratings, and the stored delivery-risk assessments and events.

```mermaid
erDiagram
    projects ||--o{ contribution_evidence : "project_id"
    tasks |o--o{ contribution_evidence : "task_id"
    users ||--o{ contribution_evidence : "user_id"
    projects ||--o{ git_activities : "project_id"
    tasks |o--o{ git_activities : "task_id"
    users ||--o{ git_activities : "user_id"
    users ||--o{ peer_evaluations : "evaluatee_id"
    users ||--o{ peer_evaluations : "evaluator_id"
    milestones |o--o{ peer_evaluations : "milestone_id"
    projects ||--o{ peer_evaluations : "project_id"
    projects ||--o{ risk_assessments : "project_id"
    milestones |o--o{ risk_events : "milestone_id"
    projects ||--o{ risk_events : "project_id"
    contribution_evidence {
        integer evidence_id PK
        integer project_id FK
        integer user_id FK
        integer task_id FK
        varchar evidence_type
        varchar description
        numeric weight
        boolean verified_flag
        integer verified_by FK
        timestamptz verified_at
        varchar source_table
        integer source_id
        timestamptz created_at
    }
    git_activities {
        integer git_id PK
        integer project_id FK
        integer task_id FK
        integer user_id FK
        text repo_url
        varchar commit_ref
        varchar commit_message
        timestamptz committed_at
        integer recorded_by FK
        timestamptz created_at
    }
    peer_evaluations {
        integer evaluation_id PK
        integer project_id FK
        integer milestone_id FK
        integer evaluator_id FK
        integer evaluatee_id FK
        numeric score
        varchar comments
        timestamptz created_at
    }
    risk_assessments {
        integer risk_id PK
        integer project_id FK
        numeric risk_score
        varchar risk_level
        text reason
        jsonb breakdown
        timestamptz calculated_at
    }
    risk_events {
        integer event_id PK
        integer project_id FK
        integer milestone_id FK
        varchar event_type
        text details
        timestamptz created_at
        timestamptz resolved_at
    }
    projects {
        integer project_id PK
    }
    tasks {
        integer task_id PK
    }
    users {
        integer user_id PK
    }
    milestones {
        integer milestone_id PK
    }
```

## ER 5. Originality (vector) and workflow control

Embeddings of proposal sections (pgvector) and the faculty decisions on possible overlap; the table that lists every legal status change.

```mermaid
erDiagram
    courses ||--o{ project_embeddings : "course_id"
    projects ||--o{ project_embeddings : "project_id"
    projects ||--o{ similarity_reviews : "matched_project_id"
    projects ||--o{ similarity_reviews : "source_project_id"
    project_embeddings {
        integer embedding_id PK
        integer project_id FK
        integer course_id FK
        varchar section_type
        integer chunk_index
        text chunk_text
        vector embedding
        varchar model_name
        boolean is_current
        varchar access_level
        timestamptz created_at
    }
    similarity_reviews {
        integer similarity_id PK
        integer source_project_id FK
        integer matched_project_id FK
        numeric similarity_score
        varchar matched_section
        text source_excerpt
        text matched_excerpt
        varchar faculty_decision
        text comments
        integer reviewed_by FK
        timestamptz created_at
        timestamptz decided_at
    }
    status_transitions {
        varchar entity_type PK
        varchar from_status PK
        varchar to_status PK
    }
    courses {
        integer course_id PK
    }
    projects {
        integer project_id PK
    }
```

