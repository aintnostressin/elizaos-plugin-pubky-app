import type { Provider, IAgentRuntime, Memory } from '@elizaos/core';
import { PubkyService } from '../services/pubkyService.js';

export const feedProvider: Provider = {
  name: 'PUBKY_FEED',
  description: 'Provides recent posts from the Pubky global feed via Nexus API',
  dynamic: true,
  position: 50,

  get: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<PubkyService>('pubky');
    if (!service || !service.isConnected()) {
      return { text: '', data: { posts: [] } };
    }

    const posts = await service.fetchGlobalFeed(10);

    if (posts.length === 0) {
      return {
        text: 'Pubky Network: No recent posts available.',
        data: { posts: [] },
      };
    }

    const lines = posts.map((p) => {
      const author = p.details.author.slice(0, 12);
      const content = p.details.content.slice(0, 200);
      const replies = p.counts?.replies || 0;
      const tags = p.counts?.tags || 0;
      return `[${author}...] ${content}${replies > 0 ? ` (${replies} replies)` : ''}${tags > 0 ? ` [${tags} tags]` : ''}`;
    });

    return {
      text: `Recent Pubky Network Activity:\n${lines.join('\n')}`,
      data: { posts },
    };
  },
};
