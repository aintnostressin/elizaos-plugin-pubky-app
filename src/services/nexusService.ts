import { logger } from '@elizaos/core';
import type { NexusPostEntry, NexusNotification } from '../types.js';

export interface INexusService {
  getUrl(): string;
  fetchGlobalFeed(limit?: number): Promise<NexusPostEntry[]>;
  fetchNotifications(): Promise<NexusNotification[]>;
  fetchPostByUri(uri: string): Promise<NexusPostEntry | null>;
  fetchPostKeysByAuthor(authorId: string, limit?: number): Promise<string[]>;
  fetchPostsByIds(postIds: string[]): Promise<NexusPostEntry[]>;
}

export class NexusService implements INexusService {
  private nexusUrl: string;
  private agentPubkyId: string;

  constructor(nexusUrl: string, agentPubkyId: string) {
    this.nexusUrl = nexusUrl;
    this.agentPubkyId = agentPubkyId;
  }

  getUrl(): string { return this.nexusUrl; }

  async fetchGlobalFeed(limit: number = 20): Promise<NexusPostEntry[]> {
    try {
      const res = await fetch(`${this.nexusUrl}/v0/stream/posts/global?limit=${limit}`);
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  }

  async fetchNotifications(): Promise<NexusNotification[]> {
    try {
      const res = await fetch(`${this.nexusUrl}/v0/user/${this.agentPubkyId}/notifications`);
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  }

  async fetchPostByUri(uri: string): Promise<NexusPostEntry | null> {
    try {
      const match = uri.match(/pubky:\/\/([^/]+)\/pub\/pubky\.app\/posts\/([^/]+)/);
      if (!match) return null;
      const [, authorId, postId] = match;
      const res = await fetch(`${this.nexusUrl}/v0/post/${authorId}/${postId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  async fetchPostKeysByAuthor(authorId: string, limit: number = 5): Promise<string[]> {
    try {
      const res = await fetch(`${this.nexusUrl}/v0/stream/posts/keys?source=author&author_id=${authorId}&limit=${limit}`);
      if (!res.ok) return [];
      const data: { post_keys?: string[] } | string[] = await res.json();
      return Array.isArray(data) ? data : (Array.isArray(data?.post_keys) ? data.post_keys : []);
    } catch { return []; }
  }

  async fetchPostsByIds(postIds: string[]): Promise<NexusPostEntry[]> {
    try {
      const res = await fetch(`${this.nexusUrl}/v0/stream/posts/by_ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_ids: postIds }),
      });
      if (!res.ok) return [];
      const posts: NexusPostEntry[] = await res.json();
      return Array.isArray(posts) ? posts : [];
    } catch { return []; }
  }
}
