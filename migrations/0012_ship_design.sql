-- Additive ship discussion anchors and append-only design records. No seeds.
CREATE TABLE ship_designs (
 ship_key TEXT PRIMARY KEY CHECK(length(ship_key) BETWEEN 1 AND 68),
 content_id TEXT NOT NULL UNIQUE REFERENCES content_objects(id),
 current_revision TEXT REFERENCES ship_revisions(revision_id),
 revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE ship_revisions (
 revision_id TEXT PRIMARY KEY CHECK(length(revision_id)=68),
 ship_key TEXT NOT NULL REFERENCES ship_designs(ship_key),
 recipe_id TEXT NOT NULL,
 definition_hash TEXT NOT NULL,
 file_sha256 TEXT NOT NULL,
 exported_at TEXT NOT NULL,
 published_at TEXT NOT NULL,
 UNIQUE(ship_key,revision_id)
);
CREATE TRIGGER ship_revision_immutable BEFORE UPDATE ON ship_revisions BEGIN SELECT RAISE(ABORT,'Ship editions are immutable'); END;
CREATE TRIGGER ship_revision_preserve BEFORE DELETE ON ship_revisions BEGIN SELECT RAISE(ABORT,'Preserve published ship editions'); END;
CREATE TABLE ship_publications (
 id TEXT PRIMARY KEY,
 ship_key TEXT NOT NULL REFERENCES ship_designs(ship_key),
 previous_revision TEXT,
 revision_id TEXT NOT NULL REFERENCES ship_revisions(revision_id),
 created_at TEXT NOT NULL,
 note TEXT NOT NULL
);
CREATE TRIGGER ship_publication_immutable BEFORE UPDATE ON ship_publications BEGIN SELECT RAISE(ABORT,'Publication history is immutable'); END;
CREATE TRIGGER ship_publication_preserve BEFORE DELETE ON ship_publications BEGIN SELECT RAISE(ABORT,'Preserve publication history'); END;
CREATE TRIGGER ship_publication_pointer AFTER INSERT ON ship_publications BEGIN
 SELECT RAISE(ABORT,'Edition belongs to another ship') WHERE NOT EXISTS(SELECT 1 FROM ship_revisions WHERE revision_id=NEW.revision_id AND ship_key=NEW.ship_key);
 UPDATE ship_designs SET current_revision=NEW.revision_id,revision=revision+1 WHERE ship_key=NEW.ship_key;
 UPDATE content_objects SET is_public=1 WHERE id=(SELECT content_id FROM ship_designs WHERE ship_key=NEW.ship_key);
END;
ALTER TABLE ideas ADD COLUMN ship_revision_id TEXT REFERENCES ship_revisions(revision_id);
ALTER TABLE ideas ADD COLUMN ship_section_key TEXT;
CREATE TRIGGER ship_discussion_anchor BEFORE INSERT ON ideas
WHEN NEW.content_id LIKE 'ship-design-%' OR NEW.ship_revision_id IS NOT NULL OR NEW.ship_section_key IS NOT NULL
BEGIN
 SELECT RAISE(ABORT,'Discussion requires a published matching ship edition') WHERE NOT EXISTS(
  SELECT 1 FROM ship_revisions r JOIN ship_designs s ON s.ship_key=r.ship_key
  WHERE r.revision_id=NEW.ship_revision_id AND s.content_id=NEW.content_id);
 SELECT RAISE(ABORT,'Unknown ship section') WHERE NEW.ship_section_key IS NOT NULL AND NEW.ship_section_key NOT IN ('purpose','hull','mass','crew','propulsion','power','weapons','protection','sensors','bridge','boarding','docking','support','swaps');
END;
CREATE TRIGGER ship_discussion_preserve BEFORE UPDATE OF content_id,ship_revision_id,ship_section_key ON ideas
WHEN (OLD.ship_revision_id IS NOT NEW.ship_revision_id) OR (OLD.ship_section_key IS NOT NEW.ship_section_key) OR ((OLD.ship_revision_id IS NOT NULL OR NEW.content_id LIKE 'ship-design-%') AND OLD.content_id IS NOT NEW.content_id)
BEGIN SELECT RAISE(ABORT,'Preserve original ship discussion context'); END;
CREATE INDEX ship_discussion_feed ON ideas(ship_revision_id,hidden,id DESC);
CREATE TABLE ship_design_events (
 id TEXT PRIMARY KEY,
 ship_key TEXT NOT NULL REFERENCES ship_designs(ship_key),
 kind TEXT NOT NULL CHECK(kind IN ('change','credit','lead')),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 profile_id TEXT REFERENCES profiles(id),
 idea_id INTEGER REFERENCES ideas(id),
 created_at TEXT NOT NULL
);
CREATE INDEX ship_design_history ON ship_design_events(ship_key,created_at DESC,id DESC);
CREATE INDEX ship_contributor_profile ON ship_design_events(profile_id,kind,created_at DESC);
CREATE TRIGGER ship_event_immutable BEFORE UPDATE ON ship_design_events BEGIN SELECT RAISE(ABORT,'Design records are append-only'); END;
CREATE TRIGGER ship_event_preserve BEFORE DELETE ON ship_design_events BEGIN SELECT RAISE(ABORT,'Preserve design records'); END;
CREATE TRIGGER ship_event_revision AFTER INSERT ON ship_design_events BEGIN UPDATE ship_designs SET revision=revision+1 WHERE ship_key=NEW.ship_key; END;
CREATE TABLE ship_follows (
 profile_id TEXT NOT NULL REFERENCES profiles(id),
 ship_key TEXT NOT NULL REFERENCES ship_designs(ship_key),
 created_at TEXT NOT NULL,
 PRIMARY KEY(profile_id,ship_key)
);
