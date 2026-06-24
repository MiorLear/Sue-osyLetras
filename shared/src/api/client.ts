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
  Emotion,
  EmotionDetail,
  LoginInput,
  Post,
  RegisterInput,
  Topic,
  ToolsContent,
  UpdateEventInput,
  UpdateProfileInput,
  UserProfile,
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
  /** POST /auth/forgot-password */
  forgotPassword(emailOrPhone: string): Promise<{ sent: true }>;
}

export interface EmotionsApi {
  /** GET /emotions */
  list(): Promise<Emotion[]>;
  /** GET /emotions/:id */
  get(id: string): Promise<EmotionDetail | null>;
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
}

export interface ToolsApi {
  /** GET /tools */
  get(): Promise<ToolsContent>;
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

export interface ApiClient {
  auth: AuthApi;
  emotions: EmotionsApi;
  posts: PostsApi;
  events: EventsApi;
  learning: LearningApi;
  tools: ToolsApi;
  profile: ProfileApi;
  misc: MiscApi;
}
