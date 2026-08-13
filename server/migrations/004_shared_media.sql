CREATE TABLE IF NOT EXISTS content_media_links (
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  asset_role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(content_id,asset_id)
);
CREATE INDEX IF NOT EXISTS idx_content_media_links_content ON content_media_links(content_id);

