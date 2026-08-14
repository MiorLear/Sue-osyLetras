-- SCALE-05 — indexes for the tables that grow, matched to the orderings the
-- paginated list endpoints now use (SCALE-01). Without these, every page of
-- the feed is a full scan plus a sort, and the cost grows with the table
-- rather than with the page.

-- PostController.FEED_SORT: created_at DESC, id DESC.
CREATE INDEX idx_posts_created_at_id ON posts (created_at DESC, id DESC);

-- Same ordering, filtered by module (the emotion tabs in the community feed).
CREATE INDEX idx_posts_module_created_at_id ON posts (module, created_at DESC, id DESC);

-- Every rendered post fans out to its comments, ordered by created_at ASC.
CREATE INDEX idx_comments_post_id_created_at ON comments (post_id, created_at);

-- EventController.AGENDA_SORT: owner's events, event_date ASC, id ASC.
CREATE INDEX idx_calendar_events_owner_date ON calendar_events (owner_user_id, event_date, id);

-- AdminUserController.ROSTER_SORT, both the full roster and the ?status= filter
-- (the approval queue).
CREATE INDEX idx_users_created_at_id ON users (created_at DESC, id);
CREATE INDEX idx_users_status_created_at ON users (status, created_at DESC, id);

-- post_likes' primary key already covers (post_id, user_id); the reverse
-- direction has no index, and "did the current user like this post" is issued
-- once per post on every feed render.
CREATE INDEX idx_post_likes_user_id ON post_likes (user_id);
