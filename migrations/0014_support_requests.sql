-- Independent private support intake. 0013 is reserved for the unpublished Commander Notes branch.
CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  actor_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('bug','accessibility','website','other')),
  subject TEXT NOT NULL CHECK(length(subject) BETWEEN 3 AND 100),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 10 AND 4000),
  contact_email TEXT NOT NULL DEFAULT '' CHECK(length(contact_email)<=254),
  game_version TEXT NOT NULL DEFAULT '' CHECK(length(game_version)<=80),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','closed')),
  private_note TEXT NOT NULL DEFAULT '' CHECK(length(private_note)<=2000),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS support_requests_status_created ON support_requests(status,created_at DESC);
