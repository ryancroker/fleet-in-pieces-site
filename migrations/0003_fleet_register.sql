-- Optional identities. No email, address, payment data, private keys or raw recovery codes.
CREATE TABLE rank_definitions (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE,
  required_descendants INTEGER,
  requires_superior_approval INTEGER NOT NULL DEFAULT 1 CHECK(requires_superior_approval IN(0,1))
);
INSERT INTO rank_definitions(id,label,sort_order,required_descendants,requires_superior_approval)
VALUES('recruit','Recruit',0,0,0);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  callsign TEXT NOT NULL,
  callsign_key TEXT NOT NULL UNIQUE,
  actor_hash TEXT NOT NULL UNIQUE,
  webauthn_user_id TEXT NOT NULL UNIQUE,
  recovery_hash TEXT NOT NULL,
  auth_version INTEGER NOT NULL DEFAULT 0,
  rank_id TEXT NOT NULL DEFAULT 'recruit' REFERENCES rank_definitions(id),
  eligible_rank_id TEXT REFERENCES rank_definitions(id),
  superior_id TEXT REFERENCES profiles(id),
  created_at TEXT NOT NULL,
  CHECK(superior_id IS NULL OR superior_id<>id)
);
CREATE INDEX profiles_superior ON profiles(superior_id,created_at,id);

CREATE TABLE profile_actors (
  actor_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  claimed_at TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX profile_actors_profile ON profile_actors(profile_id,actor_hash);

ALTER TABLE ideas ADD COLUMN profile_id TEXT REFERENCES profiles(id);
ALTER TABLE replies ADD COLUMN profile_id TEXT REFERENCES profiles(id);
CREATE INDEX ideas_profile ON ideas(profile_id,hidden,id);
CREATE INDEX replies_profile ON replies(profile_id,hidden,id);

CREATE TABLE passkeys (
  credential_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL CHECK(counter>=0),
  device_type TEXT NOT NULL CHECK(device_type IN('singleDevice','multiDevice')),
  backed_up INTEGER NOT NULL CHECK(backed_up IN(0,1)),
  transports TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX passkeys_profile ON passkeys(profile_id,created_at);
CREATE TRIGGER passkey_count_guard BEFORE INSERT ON passkeys
WHEN (SELECT COUNT(*) FROM passkeys WHERE profile_id=NEW.profile_id)>=8
BEGIN SELECT RAISE(ABORT,'passkey_capacity'); END;

CREATE TABLE identity_sessions (
  token_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  auth_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX identity_sessions_profile ON identity_sessions(profile_id,created_at);
CREATE INDEX identity_sessions_expiry ON identity_sessions(expires_at);

CREATE TABLE identity_challenges (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK(purpose IN('register','signin','recover','passkeys')),
  anonymous_actor TEXT NOT NULL,
  profile_id TEXT,
  challenge TEXT NOT NULL,
  rp_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX identity_challenges_expiry ON identity_challenges(expires_at);
CREATE INDEX identity_challenges_actor ON identity_challenges(anonymous_actor,expires_at);

-- Transitive closure keeps profile counts indexed. Every connected command tree
-- is bounded to 2,000 profiles and 12 edges of depth; there is no global signup cap.
CREATE TABLE allegiance_paths (
  ancestor_id TEXT NOT NULL REFERENCES profiles(id),
  descendant_id TEXT NOT NULL REFERENCES profiles(id),
  depth INTEGER NOT NULL CHECK(depth BETWEEN 0 AND 12),
  PRIMARY KEY(ancestor_id,descendant_id)
) WITHOUT ROWID;
CREATE INDEX allegiance_paths_descendant ON allegiance_paths(descendant_id,depth,ancestor_id);
CREATE TRIGGER profile_created AFTER INSERT ON profiles
BEGIN
  INSERT INTO profile_actors(actor_hash,profile_id,claimed_at) VALUES(NEW.actor_hash,NEW.id,NEW.created_at);
  INSERT INTO allegiance_paths(ancestor_id,descendant_id,depth) VALUES(NEW.id,NEW.id,0);
END;
CREATE TRIGGER allegiance_guard BEFORE UPDATE OF superior_id ON profiles
WHEN OLD.superior_id IS NOT NEW.superior_id AND NEW.superior_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'allegiance_cycle') WHERE NEW.superior_id=OLD.id OR EXISTS(
    SELECT 1 FROM allegiance_paths WHERE ancestor_id=OLD.id AND descendant_id=NEW.superior_id);
  SELECT RAISE(ABORT,'allegiance_depth') WHERE
    (SELECT COALESCE(MAX(depth),0) FROM allegiance_paths WHERE descendant_id=NEW.superior_id)
    + 1 + (SELECT COALESCE(MAX(depth),0) FROM allegiance_paths WHERE ancestor_id=OLD.id)>12;
  SELECT RAISE(ABORT,'allegiance_capacity') WHERE EXISTS(
    SELECT 1 FROM allegiance_paths up WHERE up.descendant_id=NEW.superior_id AND
      (SELECT COUNT(*) FROM allegiance_paths members WHERE members.ancestor_id=up.ancestor_id)
      + CASE WHEN EXISTS(SELECT 1 FROM allegiance_paths old_branch WHERE old_branch.ancestor_id=up.ancestor_id AND old_branch.descendant_id=OLD.id)
        THEN 0 ELSE (SELECT COUNT(*) FROM allegiance_paths branch WHERE branch.ancestor_id=OLD.id) END > 2000);
END;
CREATE TRIGGER allegiance_moved AFTER UPDATE OF superior_id ON profiles
WHEN OLD.superior_id IS NOT NEW.superior_id
BEGIN
  DELETE FROM allegiance_paths
    WHERE descendant_id IN(SELECT descendant_id FROM allegiance_paths WHERE ancestor_id=OLD.id)
      AND ancestor_id NOT IN(SELECT descendant_id FROM allegiance_paths WHERE ancestor_id=OLD.id);
  INSERT INTO allegiance_paths(ancestor_id,descendant_id,depth)
    SELECT up.ancestor_id,branch.descendant_id,up.depth+1+branch.depth
    FROM allegiance_paths up CROSS JOIN allegiance_paths branch
    WHERE up.descendant_id=NEW.superior_id AND branch.ancestor_id=OLD.id;
END;
