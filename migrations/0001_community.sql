-- Phase one community board. No raw IPs, browser identifiers or admin keys are stored.
PRAGMA foreign_keys = ON;

CREATE TABLE ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  system TEXT NOT NULL CHECK (system = 'missiles'),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 8 AND 2000),
  handle TEXT NOT NULL DEFAULT '' CHECK (length(handle) <= 32),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','planned','building','implemented','declined')),
  status_label TEXT NOT NULL DEFAULT '' CHECK (length(status_label) <= 60),
  developer_response TEXT NOT NULL DEFAULT '' CHECK (length(developer_response) <= 2000),
  votes INTEGER NOT NULL DEFAULT 0 CHECK (votes >= 0),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  implemented_at TEXT,
  actor_hash TEXT NOT NULL,
  request_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  UNIQUE (actor_hash, request_id)
);
CREATE INDEX ideas_top ON ideas(system, hidden, votes DESC, id DESC);
CREATE INDEX ideas_new ON ideas(system, hidden, id DESC);
CREATE INDEX ideas_repeat ON ideas(actor_hash, content_hash, created_at);

CREATE TABLE replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 2 AND 1500),
  handle TEXT NOT NULL DEFAULT '' CHECK (length(handle) <= 32),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  actor_hash TEXT NOT NULL,
  request_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  UNIQUE (actor_hash, request_id)
);
CREATE INDEX replies_thread ON replies(idea_id, hidden, id);
CREATE INDEX replies_repeat ON replies(actor_hash, idea_id, content_hash, created_at);

CREATE TABLE votes (
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  actor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (idea_id, actor_hash)
) WITHOUT ROWID;

CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('idea','reply')),
  target_id INTEGER NOT NULL,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam','privacy','threat','illegal','other')),
  detail TEXT NOT NULL DEFAULT '' CHECK (length(detail) <= 1000),
  actor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE (actor_hash, target_type, target_id)
);
CREATE INDEX reports_inbox ON reports(resolved_at, id DESC);

CREATE TABLE idea_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  status_label TEXT NOT NULL,
  developer_response TEXT NOT NULL,
  hidden INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idea_history_thread ON idea_history(idea_id, id);
CREATE TRIGGER idea_history_created AFTER INSERT ON ideas
BEGIN
  INSERT INTO idea_history(idea_id,status,status_label,developer_response,hidden,created_at)
  VALUES(NEW.id,NEW.status,NEW.status_label,NEW.developer_response,NEW.hidden,NEW.created_at);
END;
CREATE TRIGGER idea_history_changed AFTER UPDATE OF status,status_label,developer_response,hidden ON ideas
WHEN OLD.status <> NEW.status OR OLD.status_label <> NEW.status_label
  OR OLD.developer_response <> NEW.developer_response OR OLD.hidden <> NEW.hidden
BEGIN
  INSERT INTO idea_history(idea_id,status,status_label,developer_response,hidden,created_at)
  VALUES(NEW.id,NEW.status,NEW.status_label,NEW.developer_response,NEW.hidden,NEW.updated_at);
END;

-- Fixed rate windows; purge_at is refreshed to 48 hours after use. Each API rate
-- check reclaims at most 200 expired rows. Dormant sites clean up on their next request.
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  purge_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX rate_limits_expiry ON rate_limits(purge_at);
