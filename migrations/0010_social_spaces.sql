-- Additive social spaces. Existing accounts, discussions and allegiance stay in place.
ALTER TABLE profiles ADD COLUMN introduction TEXT NOT NULL DEFAULT '' CHECK(length(introduction)<=280);
INSERT INTO contribution_types(id,title,is_public) VALUES ('conversation','Conversation',1),('recruitment','Recruitment',1);
INSERT INTO content_objects(id,slug,title,kind,path,summary,is_public) VALUES
 ('social-mess','mess-deck','Mess Deck','mechanic','/mess-deck','Community conversation.',1),
 ('social-recruitment','recruitment','Recruitment','mechanic','/recruitment','Find your people.',1);
CREATE TABLE recruitment_listings (
 profile_id TEXT NOT NULL PRIMARY KEY REFERENCES profiles(id),
 idea_id INTEGER NOT NULL UNIQUE REFERENCES ideas(id),
 mode TEXT NOT NULL CHECK(mode IN ('recruiting','seeking','both','closed')),
 newcomer_friendly INTEGER NOT NULL DEFAULT 1 CHECK(newcomer_friendly IN (0,1)),
 updated_at TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 recipient_id TEXT NOT NULL REFERENCES profiles(id),
 actor_id TEXT REFERENCES profiles(id),
 kind TEXT NOT NULL CHECK(kind IN ('reply','mention','update','allegiance','topic')),
 idea_id INTEGER REFERENCES ideas(id),
 reply_id INTEGER REFERENCES replies(id),
 topic_id INTEGER REFERENCES topic_proposals(id),
 event_key TEXT NOT NULL,
 created_at TEXT NOT NULL,
 read_at TEXT,
 UNIQUE(recipient_id,event_key)
);
CREATE TRIGGER social_listing_created AFTER INSERT ON ideas WHEN NEW.content_id='social-recruitment' BEGIN
 INSERT INTO recruitment_listings(profile_id,idea_id,mode,updated_at) VALUES(NEW.profile_id,NEW.id,'closed',NEW.created_at);
END;
-- Enforce the new boundary even while an older Pages worker finishes a request.
CREATE TRIGGER social_post_guard BEFORE INSERT ON ideas WHEN
 (NEW.content_id='social-mess' AND (NEW.contribution_type<>'conversation' OR (NEW.profile_id IS NULL AND NEW.is_developer<>1))) OR
 (NEW.content_id='social-recruitment' AND (NEW.contribution_type<>'recruitment' OR NEW.profile_id IS NULL)) BEGIN
 SELECT RAISE(ABORT,'social_member_required');
END;
CREATE INDEX notifications_recipient ON notifications(recipient_id,id DESC);
CREATE TRIGGER social_reply_notice AFTER INSERT ON replies WHEN NEW.hidden=0 BEGIN
 INSERT OR IGNORE INTO notifications(recipient_id,actor_id,kind,idea_id,reply_id,event_key,created_at)
 SELECT i.profile_id,NEW.profile_id,'reply',i.id,NEW.id,'reply:'||NEW.id,NEW.created_at FROM ideas i
 WHERE i.id=NEW.idea_id AND i.profile_id IS NOT NULL AND i.profile_id IS NOT NEW.profile_id;
 -- A reply addresses its discussion owner; explicit @callsigns address other members.
 INSERT OR IGNORE INTO notifications(recipient_id,actor_id,kind,idea_id,reply_id,event_key,created_at)
 SELECT p.id,NEW.profile_id,'mention',NEW.idea_id,NEW.id,'reply:'||NEW.id,NEW.created_at FROM profiles p
 WHERE p.id IS NOT NEW.profile_id AND (' '||lower(NEW.body)||' ') GLOB '*[^a-z0-9_@-]@'||p.callsign_key||'[^a-z0-9_-]*'
 ORDER BY p.id LIMIT 8;
END;
CREATE TRIGGER social_post_mentions AFTER INSERT ON ideas WHEN NEW.hidden=0 BEGIN
 INSERT OR IGNORE INTO notifications(recipient_id,actor_id,kind,idea_id,event_key,created_at)
 SELECT p.id,NEW.profile_id,'mention',NEW.id,'post:'||NEW.id,NEW.created_at FROM profiles p
 WHERE p.id IS NOT NEW.profile_id AND (' '||lower(NEW.body)||' ') GLOB '*[^a-z0-9_@-]@'||p.callsign_key||'[^a-z0-9_-]*'
 ORDER BY p.id LIMIT 8;
END;
CREATE TRIGGER social_discussion_update AFTER UPDATE OF developer_response,decision_key,locked ON ideas
 WHEN NEW.profile_id IS NOT NULL AND (NEW.developer_response IS NOT OLD.developer_response OR NEW.decision_key IS NOT OLD.decision_key OR NEW.locked IS NOT OLD.locked) BEGIN
 INSERT OR IGNORE INTO notifications(recipient_id,kind,idea_id,event_key,created_at)
 VALUES(NEW.profile_id,'update',NEW.id,'update:'||NEW.id||':'||NEW.revision,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER social_allegiance_notice AFTER UPDATE OF superior_id ON profiles
 WHEN NEW.superior_id IS NOT NULL AND NEW.superior_id IS NOT OLD.superior_id BEGIN
 INSERT INTO notifications(recipient_id,actor_id,kind,event_key,created_at)
 VALUES(NEW.superior_id,NEW.id,'allegiance','allegiance:'||NEW.id||':'||lower(hex(randomblob(12))),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER social_topic_notice AFTER UPDATE OF status,developer_response ON topic_proposals
 WHEN NEW.profile_id IS NOT NULL AND NEW.status='approved' AND (NEW.status IS NOT OLD.status OR NEW.developer_response IS NOT OLD.developer_response) BEGIN
 INSERT INTO notifications(recipient_id,kind,topic_id,event_key,created_at)
 VALUES(NEW.profile_id,'topic',NEW.id,'topic:'||NEW.id||':'||lower(hex(randomblob(12))),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
