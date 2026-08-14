-- Real file uploads (photos/videos/documents) via Supabase Storage.
-- All MediaItem-shaped JSONB columns share the shape:
--   { "id": uuid, "title": string, "url": string, "mimeType": string, "sizeBytes": number }
--
-- Existing string-label placeholders (downloadables/stories) are wiped rather
-- than migrated in place — they were fake seed content with no real files
-- behind them; admins re-upload the real thing via the CMS.

ALTER TABLE tools_content
    ALTER COLUMN downloadables SET DEFAULT '[]',
    ADD COLUMN manual_document JSONB,
    ADD COLUMN activity_guides JSONB NOT NULL DEFAULT '[]';

UPDATE tools_content SET downloadables = '[]';

ALTER TABLE emotion_content
    ALTER COLUMN stories SET DEFAULT '[]';

UPDATE emotion_content SET stories = '[]';

ALTER TABLE topic_subtopics
    ADD COLUMN pdfs   JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN videos JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN audios JSONB NOT NULL DEFAULT '[]';

CREATE TABLE screen_intro_videos (
    screen_key VARCHAR(40) PRIMARY KEY,  -- 'home' | 'emotions' | 'learning' | 'tools'
    video      JSONB       NOT NULL
);

ALTER TABLE posts
    ADD COLUMN attachments JSONB NOT NULL DEFAULT '[]';
