import { describe, expect, it } from 'vitest';

import { createMockClient } from '../src/api/mock/index.js';
import { TOOLS } from '../src/api/mock/seed.js';

describe('MediaItem version metadata', () => {
  it('is included in seeded mock media', () => {
    expect(TOOLS.shelves[0].books[0].file).toMatchObject({
      updatedAt: expect.any(String),
      etag: expect.any(String),
    });
  });

  it('is included in newly uploaded mock media', async () => {
    const media = await createMockClient().media.upload(
      new Blob(['contenido'], { type: 'text/plain' }),
      'archivo.txt',
      'tools',
    );

    expect(Number.isNaN(Date.parse(media.updatedAt ?? ''))).toBe(false);
    expect(media.etag).toMatch(/^"mock-upload-/);
  });
});
