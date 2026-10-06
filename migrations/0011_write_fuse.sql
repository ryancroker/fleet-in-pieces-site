-- Aggregate safety counters only. No visitor identities, pageviews or content.
CREATE TABLE community_write_fuse (
  id INTEGER PRIMARY KEY CHECK(id=1),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  tripped_at INTEGER,
  reason TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  minute_key INTEGER NOT NULL DEFAULT 0,
  minute_attempts INTEGER NOT NULL DEFAULT 0,
  minute_rows INTEGER NOT NULL DEFAULT 0,
  hour_key INTEGER NOT NULL DEFAULT 0,
  hour_attempts INTEGER NOT NULL DEFAULT 0,
  hour_rows INTEGER NOT NULL DEFAULT 0,
  day_key INTEGER NOT NULL DEFAULT 0,
  day_attempts INTEGER NOT NULL DEFAULT 0,
  day_rows INTEGER NOT NULL DEFAULT 0,
  month_key INTEGER NOT NULL DEFAULT 0,
  month_attempts INTEGER NOT NULL DEFAULT 0,
  month_rows INTEGER NOT NULL DEFAULT 0
);
INSERT INTO community_write_fuse(id,started_at) VALUES(1,unixepoch());
-- At most 12 outstanding receipts. Deleted atomically when accounted for.
CREATE TABLE community_write_permits (
  token TEXT PRIMARY KEY,
  admitted_at INTEGER NOT NULL
) WITHOUT ROWID;
