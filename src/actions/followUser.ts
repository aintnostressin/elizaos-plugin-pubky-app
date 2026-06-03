import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { PubkyService } from '../services/pubkyService.js';

export const followUserAction: Action = {
  name: 'PUBKY_FOLLOW_USER',
  similes: ['FOLLOW_ON_PUBKY', 'PUBKY_FOLLOW'],
  description: 'Follow a user on the Pubky network',

  validate: async (runtime: IAgentRuntime, _message: Memory): Promise<boolean> => {
    const service = runtime.getService<PubkyService>('pubky');
    return !!service && service.isConnected();
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    const service = runtime.getService<PubkyService>('pubky');
    if (!service) {
      return { success: false, text: 'PubkyService is not available' };
    }

    try {
      const text = message.content?.text || '';

      // Extract a z32 public key (52 chars of z-base32) or pubky:// URI
      const uriMatch = text.match(/pubky:\/\/([a-z0-9]{52})/);
      const rawMatch = text.match(/\b([a-z0-9]{52})\b/);
      const userId = uriMatch?.[1] || rawMatch?.[1];

      if (!userId) {
        return {
          success: false,
          text: 'No valid Pubky user ID found. Please provide a 52-character z-base32 public key.',
        };
      }

      if (userId === service.getAgentPubkyId()) {
        return { success: false, text: 'Cannot follow yourself.' };
      }

      await service.followUser(userId);

      const resultText = `Now following user ${userId.slice(0, 12)}... on Pubky`;

      if (callback) {
        await callback({ text: resultText });
      }

      return {
        success: true,
        text: resultText,
        data: { userId },
      };
    } catch (error: any) {
      logger.error('[PUBKY_FOLLOW_USER] Failed:', error);
      return { success: false, text: `Failed to follow user: ${error.message}` };
    }
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Follow pubky://o4dksfbqk85ogzdb5osziw6befigbuxmuxkuxq8434q89uj56uyy' } },
      { name: '{{agent}}', content: { text: 'Following that user now!', actions: ['PUBKY_FOLLOW_USER'] } },
    ],
  ],
};
