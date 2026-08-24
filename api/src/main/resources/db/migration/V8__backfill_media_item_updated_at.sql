-- PWA-4.2: version existing MediaItem JSONB values without changing tables.
-- Legacy ETags cannot be reconstructed, so only updatedAt is backfilled.

UPDATE posts SET attachments = (SELECT jsonb_agg(jsonb_build_object('updatedAt', CURRENT_TIMESTAMP) || item) FROM jsonb_array_elements(attachments) item)
WHERE jsonb_array_length(attachments) > 0;

UPDATE emotion_content SET stories = (SELECT jsonb_agg(jsonb_build_object('updatedAt', CURRENT_TIMESTAMP) || item) FROM jsonb_array_elements(stories) item)
WHERE jsonb_array_length(stories) > 0;

UPDATE topic_subtopics
SET pdfs = COALESCE((SELECT jsonb_agg(jsonb_build_object('updatedAt', CURRENT_TIMESTAMP) || item) FROM jsonb_array_elements(pdfs) item), '[]'),
    videos = COALESCE((SELECT jsonb_agg(jsonb_build_object('updatedAt', CURRENT_TIMESTAMP) || item) FROM jsonb_array_elements(videos) item), '[]'),
    audios = COALESCE((SELECT jsonb_agg(jsonb_build_object('updatedAt', CURRENT_TIMESTAMP) || item) FROM jsonb_array_elements(audios) item), '[]');

UPDATE tools_content
SET downloadables = COALESCE((SELECT jsonb_agg(jsonb_build_object('updatedAt', CURRENT_TIMESTAMP) || item) FROM jsonb_array_elements(downloadables) item), '[]'),
    manual_document = CASE WHEN manual_document IS NULL THEN NULL ELSE jsonb_build_object('updatedAt', CURRENT_TIMESTAMP) || manual_document END,
    activity_guides = COALESCE((SELECT jsonb_agg(jsonb_build_object('updatedAt', CURRENT_TIMESTAMP) || item) FROM jsonb_array_elements(activity_guides) item), '[]');

UPDATE screen_intro_videos SET video = jsonb_build_object('updatedAt', CURRENT_TIMESTAMP) || video;
