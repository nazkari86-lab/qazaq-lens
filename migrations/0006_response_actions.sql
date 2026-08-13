CREATE TABLE impact_daily_new (
  day TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('data_download', 'card_download', 'embed_view', 'ask_match', 'ask_no_match', 'reply_copy', 'reply_share', 'source_open')),
  article_slug TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day, event_type, article_slug)
);

INSERT INTO impact_daily_new (day, event_type, article_slug, count)
SELECT day, event_type, article_slug, count FROM impact_daily;

DROP TABLE impact_daily;
ALTER TABLE impact_daily_new RENAME TO impact_daily;

CREATE INDEX idx_impact_daily_type_day ON impact_daily(event_type, day DESC);
