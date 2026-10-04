-- A single timestamp, written only after a successful developer-key login.
CREATE TABLE developer_presence(
 id INTEGER PRIMARY KEY CHECK(id=1),
 last_login_at TEXT
);
-- Existing creator sessions have a fixed eight-hour lifetime. Recover their
-- actual login time instead of pretending that this migration was a login.
INSERT INTO developer_presence(id,last_login_at)
SELECT 1,strftime('%Y-%m-%dT%H:%M:%fZ',MAX(expires_at)-28800,'unixepoch') FROM creator_sessions;
