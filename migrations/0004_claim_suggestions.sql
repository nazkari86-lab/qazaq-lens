CREATE TABLE IF NOT EXISTS claim_suggestions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  normalized_hash TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  context TEXT,
  locale TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'accepted', 'rejected', 'resolved'))
);
CREATE INDEX IF NOT EXISTS idx_claim_suggestions_status_created ON claim_suggestions(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_claim_suggestions_hash ON claim_suggestions(normalized_hash);
