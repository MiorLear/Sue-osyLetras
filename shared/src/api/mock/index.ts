// Mock adapter — implements ApiClient against in-memory copies of the seed data.
// State lives for the lifetime of the page (mutations persist until reload),
// mimicking a real backend closely enough for full UI development.

import type { ApiClient } from '../client.js';
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
} from '../../types/index.js';
import { SCHOOLS } from '../../design/tokens.js';
import {
  EMOTION_CONTENT,
  EMOTIONS,
  EVENTS,
  POSTS,
  PROFILE,
  TOOLS,
  TOPICS,
} from './seed.js';

/** small artificial latency so the UI exercises its loading states */
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function createMockClient(): ApiClient {
  // mutable in-memory stores seeded from the static data
  const posts: Post[] = clone(POSTS);
  const events: CalEvent[] = clone(EVENTS);
  let profile: UserProfile = clone(PROFILE);

  const authResult = (): AuthResult => ({ token: 'mock-token', user: clone(profile) });

  return {
    auth: {
      async login(_input: LoginInput) {
        await delay();
        return authResult();
      },
      async register(input: RegisterInput) {
        await delay();
        profile = {
          ...profile,
          name: input.name,
          lastname: input.lastname,
          school: input.school,
          email: input.email ?? profile.email,
          phone: input.phone ?? profile.phone,
        };
        return authResult();
      },
      async requestOtp(_phone: string) {
        await delay();
        return { sent: true as const };
      },
      async verifyOtp(_phone: string, _code: string) {
        await delay();
        return authResult();
      },
      async forgotPassword(_emailOrPhone: string) {
        await delay();
        return { sent: true as const };
      },
    },

    emotions: {
      async list(): Promise<Emotion[]> {
        await delay();
        return clone(EMOTIONS);
      },
      async get(id: string): Promise<EmotionDetail | null> {
        await delay();
        const emotion = EMOTIONS.find((e) => e.id === id);
        const content = EMOTION_CONTENT[id];
        if (!emotion || !content) return null;
        return clone({ ...emotion, content });
      },
    },

    posts: {
      async list(emotion?: string): Promise<Post[]> {
        await delay();
        const list = !emotion || emotion === 'todos' ? posts : posts.filter((p) => p.module === emotion);
        return clone(list);
      },
      async create(input: CreatePostInput): Promise<Post> {
        await delay();
        const np: Post = {
          id: Date.now(),
          user: profile.name + ' ' + profile.lastname,
          handle: '@maria_r',
          verified: false,
          time: 'ahora',
          avatarBg: '#3DBFB8',
          module: input.module ?? null,
          text: input.text,
          likes: 0,
          liked: false,
          reposts: 0,
          comments: [],
        };
        posts.unshift(np);
        return clone(np);
      },
      async toggleLike(id: number): Promise<Post> {
        await delay(40);
        const p = posts.find((x) => x.id === id);
        if (!p) throw new Error('Post not found');
        p.liked = !p.liked;
        p.likes += p.liked ? 1 : -1;
        return clone(p);
      },
      async addComment(id: number, input: CreateCommentInput): Promise<Comment> {
        await delay(40);
        const p = posts.find((x) => x.id === id);
        if (!p) throw new Error('Post not found');
        const c: Comment = {
          user: profile.name + ' ' + profile.lastname,
          initials: 'MR',
          avatarBg: '#3DBFB8',
          time: 'ahora',
          text: input.text,
        };
        p.comments.push(c);
        return clone(c);
      },
    },

    events: {
      async list(): Promise<CalEvent[]> {
        await delay();
        return clone(events);
      },
      async create(input: CreateEventInput): Promise<CalEvent> {
        await delay(40);
        const ne: CalEvent = { ...input, id: Date.now().toString() };
        events.push(ne);
        return clone(ne);
      },
      async update(id: string, input: UpdateEventInput): Promise<CalEvent> {
        await delay(40);
        const ev = events.find((e) => e.id === id);
        if (!ev) throw new Error('Event not found');
        Object.assign(ev, input);
        return clone(ev);
      },
      async remove(id: string): Promise<void> {
        await delay(40);
        const i = events.findIndex((e) => e.id === id);
        if (i >= 0) events.splice(i, 1);
      },
    },

    learning: {
      async topics(): Promise<Topic[]> {
        await delay();
        return clone(TOPICS);
      },
    },

    tools: {
      async get(): Promise<ToolsContent> {
        await delay();
        return clone(TOOLS);
      },
    },

    profile: {
      async get(): Promise<UserProfile> {
        await delay();
        return clone(profile);
      },
      async update(input: UpdateProfileInput): Promise<UserProfile> {
        await delay();
        profile = { ...profile, ...input };
        return clone(profile);
      },
    },

    misc: {
      async schools(): Promise<string[]> {
        await delay();
        return [...SCHOOLS];
      },
    },
  };
}
