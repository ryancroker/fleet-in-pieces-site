-- Private proposals; only an explicit creator approval publishes a discussion.
CREATE TABLE topic_proposals (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 100),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 8 AND 2000),
 handle TEXT NOT NULL DEFAULT '',
 profile_id TEXT REFERENCES profiles(id),
 actor_hash TEXT NOT NULL,
 request_id TEXT NOT NULL,
 content_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','declined')),
 published_title TEXT NOT NULL DEFAULT '',
 published_summary TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 reviewed_at TEXT,
 revision INTEGER NOT NULL DEFAULT 0,
 UNIQUE(actor_hash,request_id)
);
CREATE INDEX topic_proposals_inbox ON topic_proposals(status,id DESC);
CREATE INDEX topic_proposals_repeat ON topic_proposals(actor_hash,content_hash,created_at);
CREATE TRIGGER topic_proposal_publish AFTER UPDATE OF status ON topic_proposals
WHEN NEW.status='approved' AND OLD.status<>'approved'
BEGIN
 INSERT INTO content_objects(id,slug,title,kind,path,summary,is_public)
 VALUES('community-topic-'||NEW.id,'community-topic-'||NEW.id,NEW.published_title,'mechanic','/topics/'||NEW.id,NEW.published_summary,1);
END;
