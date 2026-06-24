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
  CreateTopicInput,
  Emotion,
  EmotionContent,
  EmotionDetail,
  LoginInput,
  Post,
  RegisterInput,
  Topic,
  ToolsContent,
  UpdateEventInput,
  UpdateProfileInput,
  UpdateTopicInput,
  UserProfile,
  UserStatus,
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
  USERS,
} from './seed.js';

/** small artificial latency so the UI exercises its loading states */
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function createMockClient(): ApiClient {
  // mutable in-memory stores seeded from the static data
  const posts: Post[] = clone(POSTS);
  const events: CalEvent[] = clone(EVENTS);
  const emotions: Emotion[] = clone(EMOTIONS);
  const emotionContent: Record<string, EmotionContent> = clone(EMOTION_CONTENT);
  const topics: Topic[] = clone(TOPICS);
  const users: UserProfile[] = clone(USERS);
  let tools: ToolsContent = clone(TOOLS);

  // the user resolved at login/register; profile.get() returns this one
  let currentUser: UserProfile = clone(PROFILE);

  const authResult = (): AuthResult => ({ token: 'mock-token', user: clone(currentUser) });

  return {
    auth: {
      async login(input: LoginInput) {
        await delay();
        const found = users.find((u) => u.email.toLowerCase() === (input.email || '').toLowerCase());
        currentUser = clone(found ?? PROFILE);
        return authResult();
      },
      async register(input: RegisterInput) {
        await delay();
        const newUser: UserProfile = {
          id: 'u-' + Date.now(),
          name: input.name,
          lastname: input.lastname,
          school: input.school,
          email: input.email ?? '',
          phone: input.phone ?? '',
          role: 'teacher',
          status: 'pending',
          photo: null,
        };
        users.push(newUser);
        currentUser = clone(newUser);
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
        return clone(emotions);
      },
      async get(id: string): Promise<EmotionDetail | null> {
        await delay();
        const emotion = emotions.find((e) => e.id === id);
        const content = emotionContent[id];
        if (!emotion || !content) return null;
        return clone({ ...emotion, content });
      },
      async create(input: EmotionDetail): Promise<EmotionDetail> {
        await delay(40);
        const { content, ...summary } = input;
        emotions.push(clone(summary));
        emotionContent[input.id] = clone(content);
        return clone(input);
      },
      async update(id: string, input: Partial<EmotionDetail>): Promise<EmotionDetail> {
        await delay(40);
        const emotion = emotions.find((e) => e.id === id);
        if (!emotion) throw new Error('Emotion not found');
        const { content, ...summary } = input;
        Object.assign(emotion, summary);
        if (content) emotionContent[id] = { ...emotionContent[id], ...content };
        return clone({ ...emotion, content: emotionContent[id] });
      },
      async remove(id: string): Promise<void> {
        await delay(40);
        const i = emotions.findIndex((e) => e.id === id);
        if (i >= 0) emotions.splice(i, 1);
        delete emotionContent[id];
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
          user: currentUser.name + ' ' + currentUser.lastname,
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
          user: currentUser.name + ' ' + currentUser.lastname,
          initials: (currentUser.name[0] ?? '') + (currentUser.lastname[0] ?? ''),
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
        return clone(topics);
      },
      async createTopic(input: CreateTopicInput): Promise<Topic> {
        await delay(40);
        const nt: Topic = { ...clone(input), id: 't-' + Date.now() };
        topics.push(nt);
        return clone(nt);
      },
      async updateTopic(id: string, input: UpdateTopicInput): Promise<Topic> {
        await delay(40);
        const t = topics.find((x) => x.id === id);
        if (!t) throw new Error('Topic not found');
        Object.assign(t, clone(input));
        return clone(t);
      },
      async removeTopic(id: string): Promise<void> {
        await delay(40);
        const i = topics.findIndex((x) => x.id === id);
        if (i >= 0) topics.splice(i, 1);
      },
    },

    tools: {
      async get(): Promise<ToolsContent> {
        await delay();
        return clone(tools);
      },
      async update(input: ToolsContent): Promise<ToolsContent> {
        await delay(40);
        tools = clone(input);
        return clone(tools);
      },
    },

    profile: {
      async get(): Promise<UserProfile> {
        await delay();
        return clone(currentUser);
      },
      async update(input: UpdateProfileInput): Promise<UserProfile> {
        await delay();
        currentUser = { ...currentUser, ...input };
        // keep the users store in sync so admin lists reflect profile edits
        const u = users.find((x) => x.id === currentUser.id);
        if (u) Object.assign(u, currentUser);
        return clone(currentUser);
      },
    },

    misc: {
      async schools(): Promise<string[]> {
        await delay();
        return [...SCHOOLS];
      },
    },

    admin: {
      users: {
        async list(status?: UserStatus): Promise<UserProfile[]> {
          await delay();
          const list = status ? users.filter((u) => u.status === status) : users;
          return clone(list);
        },
        async approve(id: string): Promise<UserProfile> {
          await delay(40);
          const u = users.find((x) => x.id === id);
          if (!u) throw new Error('User not found');
          u.status = 'approved';
          return clone(u);
        },
        async reject(id: string): Promise<UserProfile> {
          await delay(40);
          const u = users.find((x) => x.id === id);
          if (!u) throw new Error('User not found');
          u.status = 'rejected';
          return clone(u);
        },
      },
    },
  };
}
