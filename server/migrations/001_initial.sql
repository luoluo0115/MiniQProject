CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK(role IN ('child','parent','admin')),
  status TEXT NOT NULL DEFAULT 'active',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS child_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT,
  birth_year INTEGER,
  grade INTEGER,
  current_level TEXT NOT NULL DEFAULT 'A',
  daily_target_minutes INTEGER NOT NULL DEFAULT 15,
  preferred_topics TEXT NOT NULL DEFAULT '[]',
  last_assessment_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK(content_type IN ('book','audio','video','lesson','quiz','speaking_scene')),
  title TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  level TEXT,
  cefr_level TEXT,
  grade_min INTEGER,
  grade_max INTEGER,
  difficulty_score REAL,
  estimated_minutes INTEGER,
  topic_tags TEXT NOT NULL DEFAULT '[]',
  skill_tags TEXT NOT NULL DEFAULT '[]',
  source_type TEXT NOT NULL DEFAULT 'local_upload',
  copyright_status TEXT NOT NULL DEFAULT 'unverified',
  review_status TEXT NOT NULL DEFAULT 'pending',
  metadata TEXT NOT NULL DEFAULT '{}',
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  original_path TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  duration_ms INTEGER,
  checksum TEXT NOT NULL UNIQUE,
  processing_status TEXT NOT NULL DEFAULT 'ready',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_relations (
  source_content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  target_content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(source_content_id,target_content_id,relation_type)
);

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lemma TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phonics TEXT,
  meaning_zh TEXT,
  example_en TEXT,
  example_zh TEXT,
  level TEXT,
  topic_tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_words (
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'core',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(content_id,word_id)
);

CREATE TABLE IF NOT EXISTS learning_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL,
  content_id INTEGER REFERENCES content_items(id),
  plan_task_id INTEGER,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  foreground_ms INTEGER NOT NULL DEFAULT 0,
  effective_ms INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  completion_rate REAL NOT NULL DEFAULT 0,
  final_score REAL,
  exit_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_uuid TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES learning_sessions(id),
  plan_task_id INTEGER,
  event_type TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id INTEGER,
  occurred_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  result TEXT,
  score REAL,
  metadata TEXT NOT NULL DEFAULT '{}',
  client_platform TEXT,
  client_version TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_time ON learning_events(user_id,occurred_at);

CREATE TABLE IF NOT EXISTS user_content_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started',
  progress_value REAL NOT NULL DEFAULT 0,
  last_position TEXT NOT NULL DEFAULT '{}',
  best_score REAL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  effective_ms INTEGER NOT NULL DEFAULT 0,
  first_started_at TEXT,
  last_studied_at TEXT,
  completed_at TEXT,
  PRIMARY KEY(user_id,content_id)
);

CREATE TABLE IF NOT EXISTS user_words (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  source_type TEXT,
  source_content_id INTEGER REFERENCES content_items(id),
  collected_at TEXT NOT NULL,
  archived_at TEXT,
  PRIMARY KEY(user_id,word_id)
);

CREATE TABLE IF NOT EXISTS word_memory_states (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'new',
  repetitions INTEGER NOT NULL DEFAULT 0,
  lapse_count INTEGER NOT NULL DEFAULT 0,
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 5,
  retrievability REAL,
  current_interval_days REAL NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  next_review_at TEXT,
  last_grade INTEGER,
  algorithm_version TEXT NOT NULL DEFAULT 'ebbinghaus-v1',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,word_id)
);
CREATE INDEX IF NOT EXISTS idx_memory_due ON word_memory_states(user_id,next_review_at);

CREATE TABLE IF NOT EXISTS word_review_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_uuid TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL CHECK(grade BETWEEN 1 AND 4),
  reviewed_at TEXT NOT NULL,
  response_ms INTEGER,
  review_mode TEXT,
  previous_interval REAL,
  next_interval REAL,
  algorithm_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  target_minutes INTEGER NOT NULL,
  planned_minutes INTEGER NOT NULL DEFAULT 0,
  completed_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  generation_reason TEXT NOT NULL DEFAULT '{}',
  planner_version TEXT NOT NULL DEFAULT 'rules-v1',
  generated_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(user_id,plan_date)
);

CREATE TABLE IF NOT EXISTS daily_plan_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  content_id INTEGER REFERENCES content_items(id),
  target_value REAL NOT NULL,
  target_unit TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress_value REAL NOT NULL DEFAULT 0,
  recommendation_reason TEXT,
  completion_rule TEXT NOT NULL DEFAULT '{}',
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS daily_learning_snapshots (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date TEXT NOT NULL,
  effective_minutes INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  books_completed INTEGER NOT NULL DEFAULT 0,
  words_reviewed INTEGER NOT NULL DEFAULT 0,
  words_mastered INTEGER NOT NULL DEFAULT 0,
  speaking_turns INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  calculated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,snapshot_date)
);
