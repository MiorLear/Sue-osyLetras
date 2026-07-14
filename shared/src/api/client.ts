// The ApiClient interface is the seam both apps talk through. Screens call these
// methods — never fetch() directly — so swapping the mock adapter for the HTTP
// adapter (once the Python/Java backend exists) needs zero screen changes.
//
// Every method maps one-to-one to an endpoint in openapi.yaml.

import type {
  AuthResult,
  CalEvent,
  Comment,
  CreateCommentInput,
  CreateEventInput,
  CreatePostInput,
  CreateTopicInput,
  Emotion,
  EmotionDetail,
  LoginInput,
  MediaItem,
  Post,
  RegisterInput,
  ScreenIntroVideo,
  Topic,
  ToolsContent,
  UpdateEventInput,
  UpdateProfileInput,
  UpdateTopicInput,
  UserProfile,
  UserStatus,
} from '../types/index.js';

export interface AuthApi {
  /** POST /auth/login */
  login(input: LoginInput): Promise<AuthResult>;
  /** POST /auth/register */
  register(input: RegisterInput): Promise<AuthResult>;
  /** POST /auth/otp/request */
  requestOtp(phone: string): Promise<{ sent: true }>;
  /** POST /auth/otp/verify */
  verifyOtp(phone: string, code: string): Promise<AuthResult>;
  /** POST /auth/otp/check — validate an OTP code without an existing account (registration) */
  checkOtp(phone: string, code: string): Promise<{ sent: true }>;
  /** POST /auth/forgot-password */
  forgotPassword(emailOrPhone: string): Promise<{ sent: true }>;
  /** POST /auth/reset-password — set a new password after OTP verification */
  resetPassword(emailOrPhone: string, code: string, newPassword: string): Promise<{ sent: true }>;
}

export interface EmotionsApi {
  /** GET /emotions */
  list(): Promise<Emotion[]>;
  /** GET /emotions/:id */
  get(id: string): Promise<EmotionDetail | null>;
  /** POST /emotions — admin */
  create(input: EmotionDetail): Promise<EmotionDetail>;
  /** PUT /emotions/:id — admin */
  update(id: string, input: Partial<EmotionDetail>): Promise<EmotionDetail>;
  /** DELETE /emotions/:id — admin */
  remove(id: string): Promise<void>;
}

export interface PostsApi {
  /** GET /posts?emotion= */
  list(emotion?: string): Promise<Post[]>;
  /** POST /posts */
  create(input: CreatePostInput): Promise<Post>;
  /** POST /posts/:id/like */
  toggleLike(id: number): Promise<Post>;
  /** POST /posts/:id/comments */
  addComment(id: number, input: CreateCommentInput): Promise<Comment>;
}

export interface EventsApi {
  /** GET /events */
  list(): Promise<CalEvent[]>;
  /** POST /events */
  create(input: CreateEventInput): Promise<CalEvent>;
  /** PUT /events/:id */
  update(id: string, input: UpdateEventInput): Promise<CalEvent>;
  /** DELETE /events/:id */
  remove(id: string): Promise<void>;
}

export interface LearningApi {
  /** GET /learning/topics */
  topics(): Promise<Topic[]>;
  /** POST /learning/topics — admin */
  createTopic(input: CreateTopicInput): Promise<Topic>;
  /** PUT /learning/topics/:id — admin */
  updateTopic(id: string, input: UpdateTopicInput): Promise<Topic>;
  /** DELETE /learning/topics/:id — admin */
  removeTopic(id: string): Promise<void>;
}

export interface ToolsApi {
  /** GET /tools */
  get(): Promise<ToolsContent>;
  /** PUT /tools — admin (replaces the whole content) */
  update(input: ToolsContent): Promise<ToolsContent>;
}

export interface AdminUsersApi {
  /** GET /admin/users?status= */
  list(status?: UserStatus): Promise<UserProfile[]>;
  /** POST /admin/users/:id/approve */
  approve(id: string): Promise<UserProfile>;
  /** POST /admin/users/:id/reject */
  reject(id: string): Promise<UserProfile>;
}

export interface AdminApi {
  users: AdminUsersApi;
}

export interface ProfileApi {
  /** GET /me */
  get(): Promise<UserProfile>;
  /** PUT /me */
  update(input: UpdateProfileInput): Promise<UserProfile>;
}

export interface MiscApi {
  /** GET /schools */
  schools(): Promise<string[]>;
}

/** Categories accepted by POST /media/upload — tools/emotions/learning/screen-intros
 * are admin-only, posts/profile are any authenticated user. */
export type MediaCategory = 'tools' | 'emotions' | 'learning' | 'screen-intros' | 'posts' | 'profile';

export interface MediaApi {
  /** POST /media/upload?category= (multipart) — uploads bytes to Supabase Storage
   * and returns the resulting MediaItem. Does not attach it to anything; the
   * caller embeds the result in the relevant domain PUT/POST. */
  upload(file: Blob, filename: string, category: MediaCategory): Promise<MediaItem>;
}

export interface ScreenIntrosApi {
  /** GET /screen-intro-videos */
  list(): Promise<ScreenIntroVideo[]>;
  /** GET /screen-intro-videos/:screenKey */
  get(screenKey: string): Promise<ScreenIntroVideo | null>;
  /** PUT /screen-intro-videos/:screenKey — admin */
  update(screenKey: string, video: MediaItem): Promise<ScreenIntroVideo>;
  /** DELETE /screen-intro-videos/:screenKey — admin */
  remove(screenKey: string): Promise<void>;
}

export interface ApiClient {
  auth: AuthApi;
  emotions: EmotionsApi;
  posts: PostsApi;
  events: EventsApi;
  learning: LearningApi;
  tools: ToolsApi;
  profile: ProfileApi;
  misc: MiscApi;
  admin: AdminApi;
  media: MediaApi;
  screenIntros: ScreenIntrosApi;
}
