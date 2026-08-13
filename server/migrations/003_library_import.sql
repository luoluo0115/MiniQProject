CREATE TABLE IF NOT EXISTS library_imports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  series_hint TEXT,
  level_hint TEXT,
  detected_series TEXT,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','queued','analyzing','review','completed','failed')),
  expected_files INTEGER NOT NULL DEFAULT 0,
  uploaded_files INTEGER NOT NULL DEFAULT 0,
  detected_books INTEGER NOT NULL DEFAULT 0,
  matched_files INTEGER NOT NULL DEFAULT 0,
  exception_files INTEGER NOT NULL DEFAULT 0,
  report TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS library_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id TEXT NOT NULL REFERENCES library_imports(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  staging_path TEXT NOT NULL,
  extension TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  detected_role TEXT,
  detected_series TEXT,
  detected_level TEXT,
  normalized_title TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  exception_reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(import_id,relative_path)
);
CREATE INDEX IF NOT EXISTS idx_library_files_import_status ON library_files(import_id,status);
CREATE INDEX IF NOT EXISTS idx_library_files_checksum ON library_files(checksum);

CREATE TABLE IF NOT EXISTS library_books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id TEXT NOT NULL REFERENCES library_imports(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL,
  title TEXT NOT NULL,
  series_name TEXT,
  source_level TEXT,
  internal_level TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  match_status TEXT NOT NULL DEFAULT 'needs_review' CHECK(match_status IN ('matched','needs_review','exception','approved','rejected')),
  match_reason TEXT NOT NULL DEFAULT '[]',
  content_id INTEGER REFERENCES content_items(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(import_id,group_key)
);
CREATE INDEX IF NOT EXISTS idx_library_books_import_status ON library_books(import_id,match_status);

CREATE TABLE IF NOT EXISTS library_book_files (
  book_id INTEGER NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  file_id INTEGER NOT NULL REFERENCES library_files(id) ON DELETE CASCADE,
  asset_role TEXT NOT NULL,
  match_score REAL NOT NULL DEFAULT 0,
  PRIMARY KEY(book_id,file_id)
);

CREATE INDEX IF NOT EXISTS idx_library_imports_status ON library_imports(status,created_at);

