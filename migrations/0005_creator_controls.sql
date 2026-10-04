-- Additive creator tools. Original bodies, authors, votes, replies and URLs survive.
ALTER TABLE ideas ADD COLUMN decision_key TEXT;
ALTER TABLE ideas ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN(0,1));
ALTER TABLE ideas ADD COLUMN locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN(0,1));
ALTER TABLE ideas ADD COLUMN related_idea_id INTEGER REFERENCES ideas(id);
ALTER TABLE ideas ADD COLUMN merged_into INTEGER REFERENCES ideas(id);
ALTER TABLE ideas ADD COLUMN source_reply_id INTEGER REFERENCES replies(id);
ALTER TABLE ideas ADD COLUMN display_title TEXT NOT NULL DEFAULT '';
ALTER TABLE ideas ADD COLUMN display_body TEXT NOT NULL DEFAULT '';
ALTER TABLE ideas ADD COLUMN edit_note TEXT NOT NULL DEFAULT '';
ALTER TABLE ideas ADD COLUMN build_label TEXT NOT NULL DEFAULT '';
ALTER TABLE ideas ADD COLUMN release_date TEXT NOT NULL DEFAULT '';
ALTER TABLE ideas ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(evidence_json));
ALTER TABLE ideas ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE replies ADD COLUMN display_body TEXT NOT NULL DEFAULT '';
ALTER TABLE replies ADD COLUMN edit_note TEXT NOT NULL DEFAULT '';
ALTER TABLE replies ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX ideas_promoted_reply ON ideas(source_reply_id) WHERE source_reply_id IS NOT NULL;
CREATE INDEX ideas_merged ON ideas(merged_into,hidden,id);
CREATE INDEX ideas_decision ON ideas(decision_key,hidden,id DESC);

CREATE TABLE creator_sessions(
 token_hash TEXT PRIMARY KEY, key_version TEXT NOT NULL, expires_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX creator_session_expiry ON creator_sessions(expires_at);
CREATE TABLE moderation_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 idea_id INTEGER NOT NULL REFERENCES ideas(id),
 reply_id INTEGER REFERENCES replies(id),
 action TEXT NOT NULL,
 before_json TEXT NOT NULL CHECK(json_valid(before_json)),
 after_json TEXT NOT NULL CHECK(json_valid(after_json)),
 created_at TEXT NOT NULL
);
CREATE INDEX moderation_events_thread ON moderation_events(idea_id,id DESC);

CREATE TRIGGER creator_idea_audit AFTER UPDATE OF revision ON ideas
WHEN NEW.revision<>OLD.revision
BEGIN
 INSERT INTO moderation_events(idea_id,action,before_json,after_json,created_at)
 VALUES(NEW.id,'idea_update',
 json_object('status',OLD.status,'label',OLD.status_label,'decision',OLD.decision_key,'response',OLD.developer_response,'hidden',OLD.hidden,'pinned',OLD.pinned,'locked',OLD.locked,'content_id',OLD.content_id,'related_idea_id',OLD.related_idea_id,'merged_into',OLD.merged_into,'title',OLD.display_title,'body',OLD.display_body,'edit_note',OLD.edit_note,'build',OLD.build_label,'release_date',OLD.release_date,'evidence',json(OLD.evidence_json)),
 json_object('status',NEW.status,'label',NEW.status_label,'decision',NEW.decision_key,'response',NEW.developer_response,'hidden',NEW.hidden,'pinned',NEW.pinned,'locked',NEW.locked,'content_id',NEW.content_id,'related_idea_id',NEW.related_idea_id,'merged_into',NEW.merged_into,'title',NEW.display_title,'body',NEW.display_body,'edit_note',NEW.edit_note,'build',NEW.build_label,'release_date',NEW.release_date,'evidence',json(NEW.evidence_json)),NEW.updated_at);
END;
CREATE TRIGGER creator_reply_audit AFTER UPDATE OF revision ON replies
WHEN NEW.revision<>OLD.revision
BEGIN
 INSERT INTO moderation_events(idea_id,reply_id,action,before_json,after_json,created_at)
 VALUES(NEW.idea_id,NEW.id,'reply_update',json_object('hidden',OLD.hidden,'body',OLD.display_body,'edit_note',OLD.edit_note),json_object('hidden',NEW.hidden,'body',NEW.display_body,'edit_note',NEW.edit_note),NEW.updated_at);
END;

-- Merged groups are flat. A single statement moves a whole group atomically.
CREATE TRIGGER creator_merge_guard BEFORE UPDATE OF merged_into ON ideas
WHEN NEW.merged_into IS NOT NULL AND NEW.merged_into IS NOT OLD.merged_into
BEGIN
 SELECT RAISE(ABORT,'invalid_merge_target') WHERE NEW.merged_into=NEW.id OR NOT EXISTS(
  SELECT 1 FROM ideas WHERE id=NEW.merged_into AND merged_into IS NULL AND hidden=0
 );
 SELECT RAISE(ABORT,'merge_capacity') WHERE
  (SELECT COUNT(*) FROM ideas WHERE id=NEW.merged_into OR merged_into=NEW.merged_into OR id=NEW.id OR merged_into=NEW.id)>50;
END;
CREATE TRIGGER creator_merge_branch AFTER UPDATE OF merged_into ON ideas
WHEN NEW.merged_into IS NOT NULL AND NEW.merged_into IS NOT OLD.merged_into
BEGIN
 UPDATE ideas SET merged_into=NEW.merged_into,related_idea_id=NEW.merged_into,
  locked=1,revision=revision+1,updated_at=NEW.updated_at WHERE merged_into=NEW.id AND id<>NEW.id;
END;
