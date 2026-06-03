import { describe, it, expect, vi } from 'vitest';
import { extractPostIds, checkHasPostedRecently } from './pubkyService.js';
import type { PostsStorage } from './pubkyService.js';

// --- extractPostIds ---

describe('extractPostIds', () => {
  it('strips full paths and returns bare IDs', () => {
    expect(extractPostIds([
      '/pub/pubky.app/posts/01JABCDEFGHIJ',
      '/pub/pubky.app/posts/01JABCDEFGHIK',
    ])).toEqual(['01JABCDEFGHIJ', '01JABCDEFGHIK']);
  });

  it('handles bare filenames without a path prefix', () => {
    expect(extractPostIds(['01JABCDEFGHIJ'])).toEqual(['01JABCDEFGHIJ']);
  });

  it('filters out directory entries and invalid IDs', () => {
    expect(extractPostIds([
      '/pub/pubky.app/posts/01JABCDEFGHIJ',
      '/pub/pubky.app/posts/', // directory path — resolves to "posts" after stripping slash
      'not-an-id!',
      '',
      'short',                 // too short to be a real post ID
    ])).toEqual(['01JABCDEFGHIJ']);
  });

  it('returns empty array for empty input', () => {
    expect(extractPostIds([])).toEqual([]);
  });
});

// --- checkHasPostedRecently ---

function makeStorage(posts: Array<{ id: string; lastModifiedMs: number; parent?: string }>): PostsStorage {
  return {
    list: vi.fn().mockResolvedValue(posts.map(p => `/pub/pubky.app/posts/${p.id}`)),
    stats: vi.fn().mockImplementation(async (path: string) => {
      const id = path.split('/').pop()!;
      const post = posts.find(p => p.id === id);
      return post ? { lastModifiedMs: post.lastModifiedMs } : null;
    }),
    getJson: vi.fn().mockImplementation(async (path: string) => {
      const id = path.split('/').pop()!;
      const post = posts.find(p => p.id === id);
      if (!post) return null;
      return post.parent ? { content: 'reply', parent: post.parent } : { content: 'top-level' };
    }),
  };
}

const COOLDOWN = 60; // 60 minutes
const NOW = 1_000_000_000_000; // fixed "now" timestamp
const PATH = '/pub/pubky.app/posts/';

// Realistic Crockford Base32 post IDs sampled from a live homeserver.
const ID_RECENT   = '00356127FFFQG'; // newest
const ID_RECENT2  = '0035611SKRRBG';
const ID_OLD      = '003560TAB4FS0'; // oldest — sorts before the recent ones when reversed

describe('checkHasPostedRecently', () => {
  it('returns false when there are no posts', async () => {
    const storage = makeStorage([]);
    expect(await checkHasPostedRecently(storage, PATH, COOLDOWN, NOW)).toBe(false);
  });

  it('returns false when cooldownMinutes is 0 (gate disabled)', async () => {
    const storage = makeStorage([{ id: ID_RECENT, lastModifiedMs: NOW - 1000 }]);
    expect(await checkHasPostedRecently(storage, PATH, 0, NOW)).toBe(false);
  });

  it('returns true when a top-level post exists within the cooldown window', async () => {
    const storage = makeStorage([
      { id: ID_RECENT, lastModifiedMs: NOW - 30 * 60 * 1000 }, // 30 min ago
    ]);
    expect(await checkHasPostedRecently(storage, PATH, COOLDOWN, NOW)).toBe(true);
  });

  it('returns false when the only post is older than the cooldown window', async () => {
    const storage = makeStorage([
      { id: ID_RECENT, lastModifiedMs: NOW - 90 * 60 * 1000 }, // 90 min ago
    ]);
    expect(await checkHasPostedRecently(storage, PATH, COOLDOWN, NOW)).toBe(false);
  });

  it('ignores reply posts and returns false when only replies are recent', async () => {
    const storage = makeStorage([
      { id: ID_RECENT, lastModifiedMs: NOW - 5 * 60 * 1000, parent: 'pubky://someone/pub/pubky.app/posts/OTHER' },
    ]);
    expect(await checkHasPostedRecently(storage, PATH, COOLDOWN, NOW)).toBe(false);
  });

  it('returns true when a top-level post is recent even alongside recent replies', async () => {
    const storage = makeStorage([
      { id: ID_RECENT,  lastModifiedMs: NOW - 10 * 60 * 1000 }, // top-level
      { id: ID_RECENT2, lastModifiedMs: NOW -  5 * 60 * 1000, parent: 'other' }, // reply
    ]);
    expect(await checkHasPostedRecently(storage, PATH, COOLDOWN, NOW)).toBe(true);
  });

  it('stops scanning once it hits a post older than the cooldown window', async () => {
    const storage = makeStorage([
      { id: ID_RECENT, lastModifiedMs: NOW - 90 * 60 * 1000 }, // outside window
    ]);
    const statSpy = storage.stats as ReturnType<typeof vi.fn>;
    await checkHasPostedRecently(storage, PATH, COOLDOWN, NOW);
    // stats called once, getJson never called (broke early)
    expect(statSpy).toHaveBeenCalledTimes(1);
    expect(storage.getJson).not.toHaveBeenCalled();
  });
});
