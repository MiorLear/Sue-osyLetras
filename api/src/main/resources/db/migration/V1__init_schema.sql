-- ExplorArte API — initial schema, mirrors shared/openapi.yaml + shared/src/api/mock/seed.ts

CREATE TABLE users (
    id            VARCHAR(64)  PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    lastname      VARCHAR(120) NOT NULL,
    email         VARCHAR(160) NOT NULL UNIQUE,
    phone         VARCHAR(40),
    password_hash VARCHAR(200) NOT NULL,
    institucion   VARCHAR(160),
    ubicacion     VARCHAR(160),
    role          VARCHAR(20)  NOT NULL,
    status        VARCHAR(20)  NOT NULL,
    photo         TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE schools (
    id   BIGSERIAL    PRIMARY KEY,
    name VARCHAR(160) NOT NULL UNIQUE
);

CREATE TABLE emotions (
    id    VARCHAR(64) PRIMARY KEY,
    name  VARCHAR(120) NOT NULL,
    emoji VARCHAR(16)  NOT NULL,
    color VARCHAR(16)  NOT NULL,
    bg    VARCHAR(16)  NOT NULL
);

CREATE TABLE emotion_content (
    emotion_id  VARCHAR(64) PRIMARY KEY REFERENCES emotions(id) ON DELETE CASCADE,
    description TEXT   NOT NULL,
    classroom   TEXT   NOT NULL,
    questions   JSONB  NOT NULL DEFAULT '[]',
    activities  JSONB  NOT NULL DEFAULT '[]',
    stories     JSONB  NOT NULL DEFAULT '[]'
);

CREATE TABLE posts (
    id              BIGSERIAL    PRIMARY KEY,
    author_user_id  VARCHAR(64)  REFERENCES users(id) ON DELETE SET NULL,
    user_name       VARCHAR(160) NOT NULL,
    handle          VARCHAR(80)  NOT NULL,
    verified        BOOLEAN      NOT NULL DEFAULT false,
    avatar_bg       VARCHAR(16)  NOT NULL,
    module          VARCHAR(64),
    text            TEXT         NOT NULL,
    likes_count     INT          NOT NULL DEFAULT 0,
    reposts         INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE post_likes (
    post_id BIGINT      NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE comments (
    id         BIGSERIAL    PRIMARY KEY,
    post_id    BIGINT       NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_name  VARCHAR(160) NOT NULL,
    initials   VARCHAR(8)   NOT NULL,
    avatar_bg  VARCHAR(16)  NOT NULL,
    text       TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE calendar_events (
    id             VARCHAR(64)  PRIMARY KEY,
    owner_user_id  VARCHAR(64)  REFERENCES users(id) ON DELETE CASCADE,
    title          VARCHAR(200) NOT NULL,
    type           VARCHAR(20)  NOT NULL,
    event_date     DATE         NOT NULL,
    start_time     VARCHAR(10)  NOT NULL,
    end_time       VARCHAR(10)  NOT NULL,
    reminder       VARCHAR(40)  NOT NULL,
    completed      BOOLEAN
);

CREATE TABLE topics (
    id    VARCHAR(64)  PRIMARY KEY,
    emoji VARCHAR(16)  NOT NULL,
    title VARCHAR(200) NOT NULL
);

CREATE TABLE topic_subtopics (
    id       BIGSERIAL    PRIMARY KEY,
    topic_id VARCHAR(64)  NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    -- Nullable: Hibernate's unidirectional @OneToMany + @OrderColumn inserts
    -- each child row first (position still unset) and fills in the index
    -- with a follow-up UPDATE, so this column is briefly NULL mid-flush.
    position INT,
    title    VARCHAR(200) NOT NULL,
    body     TEXT         NOT NULL
);

CREATE TABLE tools_content (
    id            SMALLINT PRIMARY KEY DEFAULT 1,
    downloadables JSONB    NOT NULL DEFAULT '[]',
    bibliography  JSONB    NOT NULL DEFAULT '[]',
    CONSTRAINT tools_content_singleton CHECK (id = 1)
);
