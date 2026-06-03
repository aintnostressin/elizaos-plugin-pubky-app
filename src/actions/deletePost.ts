import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { PubkyService } from '../services/pubkyService.js';

export const deletePostAction: Action = {
  name: 'PUBKY_DELETE_POST',
  similes: ['DELETE_POST', 'REMOVE_POST', 'DELETE_PUBKY_POST'],
  description: 'Delete a post from the Pubky homeserver by its post ID',

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const service = runtime.getService<PubkyService>('pubky');
    if (!service || !service.isConnected()) return false;
    const text = message.content?.text || '';
    return text.toLowerCase().includes('delete') || text.toLowerCase().includes('remove');
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

      // Extract post ID — 13-char alphanumeric Crockford Base32
      const idMatch = text.match(/\b([0-9A-Z]{13})\b/i);
      if (!idMatch) {
        return {
          success: false,
          text: 'No post ID found. Please provide the 13-character post ID (e.g. 001JEHEA2XZ80).',
        };
      }
      const postId = idMatch[1].toUpperCase();

      await service.deletePost(postId);

      const resultText = `Deleted post ${postId} from Pubky.`;

      if (callback) {
        await callback({ text: resultText });
      }

      return {
        success: true,
        text: resultText,
        data: { postId },
      };
    } catch (error: any) {
      logger.error(`[PUBKY_DELETE_POST] Failed: ${error}`);
      return { success: false, text: `Failed to delete post: ${error.message}` };
    }
  },

  examples: [
    [
      { name: '{{user1}}', content: { text: 'Delete post 001JEHEA2XZ80' } },
      { name: '{{agent}}', content: { text: 'Deleting that post now.', actions: ['PUBKY_DELETE_POST'] } },
    ],
  ],
};
