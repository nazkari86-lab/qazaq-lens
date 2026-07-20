CREATE TABLE IF NOT EXISTS correction_reports (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_title TEXT,
  issue TEXT NOT NULL,
  reason TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT,
  suggestion TEXT,
  reporter_name TEXT,
  reporter_email TEXT,
  may_credit INTEGER NOT NULL DEFAULT 0 CHECK (may_credit IN (0, 1)),
  locale TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'accepted', 'rejected', 'resolved'))
);
CREATE INDEX IF NOT EXISTS idx_correction_reports_status_created ON correction_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_correction_reports_page_url ON correction_reports(page_url);
