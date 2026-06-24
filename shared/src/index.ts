// @explorarte/shared — types, design tokens and the swappable API client.

export * from './types/index.js';
export * from './design/tokens.js';
export * from './api/index.js';

// seed data is exported too, so a backend can import it to seed its DB
export * as seed from './api/mock/seed.js';
