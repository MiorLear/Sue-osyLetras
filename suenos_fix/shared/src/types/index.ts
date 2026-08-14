// Domain models for ExplorArte — the single source of truth shared by the web
// app, the mobile app, the mock client, the HTTP client and (later) the backend
// DTOs. Lifted from the React Native screens so the two apps stay in lockstep.

// ── Media (photos/videos/documents) ─────────────────────────────────────────

/** A real uploaded file (photo, video, or document), stored via Supabase
 * Storage. Used everywhere a piece of content references a file — tools
 * downloadables, emotion stories, learning attachments, forum posts, profile
 * photos, screen intro videos. */
export interface MediaItem {
  /** stable id — used as the offline-cache key on mobile */
  id: string;
  title: string;
  /** publicly fetchable URL */
  url: string;
  mimeType: string;
  sizeBytes: number;
}

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
  /** real uploaded story files (video/audio/pdf) */
  stories: MediaItem[];
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
  /** photo/video attached by the author, if any (practically 0-1 items) */
  attachments: MediaItem[];
}

/** Payload to create a post. */
export interface CreatePostInput {
  text: string;
  module?: string | null;
  attachments?: MediaItem[];
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
  pdfs: MediaItem[];
  videos: MediaItem[];
  audios: MediaItem[];
}

export interface Topic {
  id: string;
  emoji: string;
  title: string;
  subtopics: SubTopic[];
}

/** Payload to create a learning topic (id is assigned by the server). */
export type CreateTopicInput = Omit<Topic, 'id'>;
/** Payload to update a learning topic. */
export type UpdateTopicInput = Partial<Omit<Topic, 'id'>>;

// ── Teacher toolkit ─────────────────────────────────────────────────────────

export interface ToolsContent {
  /** downloadable resources list (PDFs/docs) */
  downloadables: MediaItem[];
  /** recommended bibliography titles */
  bibliography: string[];
  /** the single featured "Manual ExplorArte" document, or null if not uploaded yet */
  manualDocument: MediaItem | null;
  /** the featured "Guías de actividades" documents */
  activityGuides: MediaItem[];
}

// ── Screen intro videos ──────────────────────────────────────────────────────

export type ScreenKey = 'home' | 'emotions' | 'learning' | 'tools';

export interface ScreenIntroVideo {
  screenKey: string;
  video: MediaItem;
}

// ── Profile / auth ────────────────────────────────────────────────────────────

/** Account type. Teachers use the app; admins approve users and manage content. */
export type UserRole = 'teacher' | 'admin';

/** Approval state of a teacher account. Admins are always 'approved'. */
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  /** stable user id (slug or uuid) */
  id: string;
  name: string;
  lastname: string;
  email: string;
  phone: string;
  /** name of the school / institution the teacher belongs to */
  institucion: string;
  /** location (municipality/zone) used for the admin KPIs */
  ubicacion: string;
  role: UserRole;
  status: UserStatus;
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
  institucion: string;
  ubicacion: string;
  email?: string;
  password?: string;
  phone?: string;
}
