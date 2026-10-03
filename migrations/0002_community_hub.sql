-- Additive content registry: every existing idea, vote, reply and /i/{id} survives.
-- The legacy ideas.system CHECK is retained for rollback/old-client compatibility.
CREATE TABLE content_objects (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 80),
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 100),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  kind TEXT NOT NULL CHECK (kind IN ('system','ship','mechanic')),
  path TEXT NOT NULL UNIQUE CHECK (substr(path,1,1)='/' AND substr(path,1,2)<>'//'),
  summary TEXT NOT NULL DEFAULT '',
  current_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(current_json)),
  media_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(media_json)),
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0,1))
);

-- Registry metadata, not fabricated community activity. Only the actual missile page exists.
INSERT INTO content_objects(id,slug,title,kind,path,summary,current_json,media_json,is_public)
VALUES ('system-missiles','missiles','Missiles','system','/systems/missiles',
  'Physical launch tubes, shared targeting information and finite powered guidance.',
  '["Physical launch tubes","Shared targeting information","Finite ammunition and powered guidance","Point defense interception","Physical hull and component damage"]',
  '[{"kind":"video","src":"/assets/video/missile-range.mp4","poster":"/assets/images/missile-range-poster.webp","width":576,"height":1024,"label":"Archived missile range development footage"}]',1);

CREATE TABLE contribution_types (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0,1))
);
INSERT INTO contribution_types(id,title,is_public) VALUES('idea','Idea',1);

-- SQLite permits an added REFERENCES column with a NULL default. Backfill it,
-- then support old inserts with a trigger rather than rebuilding production tables.
ALTER TABLE ideas ADD COLUMN content_id TEXT REFERENCES content_objects(id);
ALTER TABLE ideas ADD COLUMN contribution_type TEXT NOT NULL DEFAULT 'idea';
ALTER TABLE ideas ADD COLUMN command_at TEXT;
UPDATE ideas SET content_id='system-missiles' WHERE content_id IS NULL AND system='missiles';
UPDATE ideas SET command_at=updated_at
  WHERE status<>'new' OR trim(status_label)<>'' OR trim(developer_response)<>'';

CREATE TRIGGER ideas_legacy_content AFTER INSERT ON ideas
WHEN NEW.content_id IS NULL AND NEW.system='missiles'
BEGIN
  UPDATE ideas SET content_id='system-missiles' WHERE id=NEW.id;
END;
CREATE TRIGGER ideas_contribution_insert BEFORE INSERT ON ideas
WHEN NOT EXISTS(SELECT 1 FROM contribution_types WHERE id=NEW.contribution_type)
BEGIN
  SELECT RAISE(ABORT,'Unknown contribution type');
END;
CREATE TRIGGER ideas_contribution_update BEFORE UPDATE OF contribution_type ON ideas
WHEN NOT EXISTS(SELECT 1 FROM contribution_types WHERE id=NEW.contribution_type)
BEGIN
  SELECT RAISE(ABORT,'Unknown contribution type');
END;

CREATE INDEX ideas_content_top ON ideas(content_id,hidden,votes DESC,id DESC);
CREATE INDEX ideas_content_new ON ideas(content_id,hidden,id DESC);
CREATE INDEX ideas_content_decisions ON ideas(content_id,hidden,command_at DESC,id DESC);
CREATE INDEX ideas_content_implemented ON ideas(content_id,hidden,status,implemented_at DESC,id DESC);
CREATE INDEX ideas_discovery_top ON ideas(hidden,votes DESC,id DESC);
CREATE INDEX ideas_discovery_new ON ideas(hidden,id DESC);
CREATE INDEX ideas_discovery_implemented ON ideas(hidden,status,implemented_at DESC,id DESC);
CREATE INDEX votes_recent ON votes(idea_id,created_at);
CREATE INDEX replies_recent ON replies(idea_id,hidden,created_at);
