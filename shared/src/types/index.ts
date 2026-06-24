// Domain models for ExplorArte — the single source of truth shared by the web
// app, the mobile app, the mock client, the HTTP client and (later) the backend
// DTOs. Lifted from the React Native screens so the two apps stay in lockstep.

// ── Emotions ────────────────────────────────────────────────────────────────

/** Summary card shown in the emotions library grid. */
export interface Emotion {
  /** slug used in the route /emociones/:id */
  id: string;
  name: string;
  emoji: string;
  /** accent color (hex) */
  color: string;
  /** soft background color (hex) */
  bg: string;
}

/** Full pedagogical content for a single emotion (the detail screen). */
export interface EmotionContent {
  description: string;
  classroom: string;
  questions: string[];
  activities: string[];
  stories: string[];
}

/** Emotion summary + its detail content (returned by GET /emotions/:id). */
export interface EmotionDetail extends Emotion {
  content: EmotionContent;
}

// ── Community ─────────────────────────────────────────────────────────────────

export interface Comment {
  user: string;
  initials: string;
  avatarBg: string;
  time: string;
  text: string;
}

export interface Post {
  id: number;
  user: string;
  handle: string;
  verified: boolean;
  time: string;
  avatarBg: string;
  /** emotion id this post is tagged with, or null */
  module: string | null;
  text: string;
  likes: number;
  liked: boolean;
  reposts: number;
  comments: Comment[];
}

/** Payload to create a post. */
export interface CreatePostInput {
  text: string;
  module?: string | null;
}

/** Payload to add a comment to a post. */
export interface CreateCommentInput {
  text: string;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export type EventType = 'sesión' | 'tarea' | 'recordatorio' | 'evento';

export interface CalEvent {
  id: string;
  title: string;
  type: EventType;
  /** ISO date string (YYYY-MM-DD) over the wire; the apps parse to Date locally. */
  date: string;
  startTime: string;
  endTime: string;
  reminder: string;
  completed?: boolean;
}

export type CreateEventInput = Omit<CalEvent, 'id'>;
export type UpdateEventInput = Partial<Omit<CalEvent, 'id'>>;

// ── Learning ──────────────────────────────────────────────────────────────────

export interface SubTopic {
  title: string;
  body: string;
}

export interface Topic {
  id: string;
  emoji: string;
  title: string;
  subtopics: SubTopic[];
}

// ── Teacher toolkit ─────────────────────────────────────────────────────────

export interface ToolsContent {
  /** simple labels for the downloadable resources list */
  downloadables: string[];
  /** recommended bibliography titles */
  bibliography: string[];
}

// ── Profile / auth ────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  lastname: string;
  email: string;
  phone: string;
  school: string;
  /** data/object URL of the profile photo, or null */
  photo?: string | null;
}

export type UpdateProfileInput = Partial<UserProfile>;

export interface AuthResult {
  /** mock token today; real JWT once the backend exists */
  token: string;
  user: UserProfile;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  lastname: string;
  school: string;
  email?: string;
  password?: string;
  phone?: string;
}
