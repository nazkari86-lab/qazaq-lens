CREATE TABLE IF NOT EXISTS impact_daily (
  day TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('data_download', 'card_download', 'embed_view', 'ask_match', 'ask_no_match')),
  article_slug TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event_type, article_slug)
);
CREATE TABLE IF NOT EXISTS external_citations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT NOT NULL,
  publisher TEXT NOT NULL,
  url TEXT NOT NULL,
  cited_at TEXT,
  article_slug TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'removed'))
);
CREATE TABLE IF NOT EXISTS editorial_outcomes (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('correction_accepted', 'article_updated', 'source_replaced', 'claim_reworded')),
  article_slug TEXT,
  public_note TEXT NOT NULL,
  correction_report_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_impact_daily_type_day ON impact_daily(event_type, day DESC);
CREATE INDEX IF NOT EXISTS idx_external_citations_status ON external_citations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_editorial_outcomes_created ON editorial_outcomes(created_at DESC);
