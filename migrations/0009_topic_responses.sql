-- Topic acknowledgements are not newly implemented community features.
ALTER TABLE topic_proposals ADD COLUMN acknowledgement TEXT NOT NULL DEFAULT '' CHECK(acknowledgement IN('','already_in_game'));
ALTER TABLE topic_proposals ADD COLUMN developer_response TEXT NOT NULL DEFAULT '' CHECK(length(developer_response)<=2000);
ALTER TABLE topic_proposals ADD COLUMN responded_at TEXT;
ALTER TABLE topic_proposals ADD COLUMN first_responded_at TEXT;

-- A revision can refine the public introduction while retaining the submission.
CREATE TRIGGER topic_public_edit AFTER UPDATE OF published_title,published_summary ON topic_proposals
WHEN NEW.status='approved' AND OLD.status='approved'
BEGIN
 UPDATE content_objects SET title=NEW.published_title,summary=NEW.published_summary
 WHERE id='community-topic-'||NEW.id;
END;
