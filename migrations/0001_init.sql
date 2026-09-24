-- TCSN roster schema

CREATE TABLE people (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  name                       TEXT    NOT NULL,
  email                      TEXT,
  phone                      TEXT,
  net_id                     TEXT,
  year                       TEXT,
  major                      TEXT,
  track                      TEXT,
  first_choice               TEXT,
  second_choice              TEXT,
  third_choice               TEXT,
  preferred_roles_production TEXT,
  has_car                    TEXT,
  can_transport_equipment    TEXT,
  weekend_availability       TEXT,
  availability_notes         TEXT,
  interest_form_submitted    INTEGER NOT NULL DEFAULT 0,  -- boolean 0/1
  production_form_submitted  INTEGER NOT NULL DEFAULT 0,  -- boolean 0/1
  availability_form_status   TEXT,
  interviewed                INTEGER NOT NULL DEFAULT 0,  -- boolean 0/1
  interview_date             TEXT,
  best_fit                   TEXT,
  experience_level           TEXT,
  immediate_read             TEXT,
  skills_experience_summary  TEXT,
  status_active              TEXT    NOT NULL DEFAULT 'Active',
  created_at                 TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_people_name   ON people (name COLLATE NOCASE);
CREATE INDEX idx_people_net_id ON people (net_id COLLATE NOCASE);

-- Append-only log of notes about a person.
CREATE TABLE notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id  INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  category   TEXT    NOT NULL DEFAULT 'General',
  note       TEXT    NOT NULL,
  entry_date TEXT    NOT NULL DEFAULT (date('now')),  -- the date the note is ABOUT (YYYY-MM-DD)
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- when it was entered (UTC)
  author     TEXT
);

CREATE INDEX idx_notes_person ON notes (person_id, entry_date DESC, created_at DESC);
