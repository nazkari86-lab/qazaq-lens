CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_slug TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT,
  body TEXT NOT NULL,
  locale TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  moderator_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_public_page ON comments(page_slug, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_moderation ON comments(status, created_at ASC);
