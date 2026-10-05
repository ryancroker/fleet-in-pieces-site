-- Only the server can set this after verifying a developer session.
-- Existing authors/notes stay unchanged; a callsign never implies authority.
ALTER TABLE ideas ADD COLUMN is_developer INTEGER NOT NULL DEFAULT 0 CHECK(is_developer IN(0,1));
ALTER TABLE replies ADD COLUMN is_developer INTEGER NOT NULL DEFAULT 0 CHECK(is_developer IN(0,1));
