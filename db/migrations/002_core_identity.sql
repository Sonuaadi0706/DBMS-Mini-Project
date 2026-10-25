-- 002_core_identity.sql
SET search_path = projectpulse, public;

CREATE TABLE departments (
  dept_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dept_code   VARCHAR(10)  NOT NULL UNIQUE,
  dept_name   VARCHAR(120) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  course_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dept_id        INT NOT NULL REFERENCES departments(dept_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  course_code    VARCHAR(20)  NOT NULL,
  course_name    VARCHAR(150) NOT NULL,
  semester       VARCHAR(20)  NOT NULL,                       -- e.g. 'Sem 5'
  academic_year  VARCHAR(9)   NOT NULL CHECK (academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (course_code, semester, academic_year)
);

CREATE TABLE users (
  user_id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
  email              CITEXT       NOT NULL UNIQUE
                     CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  password_hash      TEXT         NOT NULL,                  -- bcrypt hash, never plain text
  status             VARCHAR(12)  NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','inactive','suspended')),
  dept_id            INT REFERENCES departments(dept_id) ON DELETE SET NULL ON UPDATE CASCADE,
  identifier         VARCHAR(30) UNIQUE,                     -- USN / employee id (optional)
  failed_login_count INT NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until       TIMESTAMPTZ,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  role_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_name    VARCHAR(20) NOT NULL UNIQUE
               CHECK (role_name IN ('student','faculty_guide','reviewer','admin')),
  description  TEXT
);

CREATE TABLE user_roles (
  user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_id      INT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by  INT REFERENCES users(user_id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE teams (
  team_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id   INT NOT NULL REFERENCES courses(course_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  team_name   VARCHAR(80) NOT NULL,
  created_by  INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, team_name),
  UNIQUE (team_id, course_id)        -- lets child tables carry course_id via a composite FK
);

-- A student may be in only ONE team per course: course_id is copied here through a
-- composite FK to teams, so UNIQUE(course_id, user_id) is enforced by the database itself.
CREATE TABLE team_members (
  team_id         INT NOT NULL,
  course_id       INT NOT NULL,
  user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  member_role     VARCHAR(10) NOT NULL DEFAULT 'member' CHECK (member_role IN ('leader','member')),
  responsibility  VARCHAR(200),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id, course_id) REFERENCES teams(team_id, course_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE (course_id, user_id)
);
CREATE UNIQUE INDEX uq_one_leader_per_team ON team_members(team_id) WHERE member_role = 'leader';

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
