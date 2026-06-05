import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { logger, ModelType } from '@elizaos/core';
import { ENV } from '../env.js';
import { PubkyService } from '../services/pubkyService.js';

const getDryRun = (runtime: IAgentRuntime): boolean => {
  return (runtime.getSetting(ENV.PUBKY_DRY_RUN) ?? process.env[ENV.PUBKY_DRY_RUN]) === 'true';
};

export const replyToPostAction: Action = {
  name: 'PUBKY_REPLY',
  similes: ['REPLY_ON_PUBKY', 'PUBKY_RESPOND', 'RESPOND_TO_POST'],
  description: 'Reply to a specific post on the Pubky network',

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const service = runtime.getService<PubkyService>('pubky');
    if (!service || !service.isConnected()) return false;

    // Check if message references a post URI
    const text = message.content?.text || '';
    return text.includes('pubky://') || text.includes('reply');
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

    const dryRun = getDryRun(runtime);

    try {
      const text = message.content?.text || '';

      // Extract post URI from the message
      const uriMatch = text.match(/pubky:\/\/[^\s]+/);
      if (!uriMatch) {
        return { success: false, text: 'No Pubky post URI found in the message. Please include a pubky:// URI.' };
      }
      const parentUri = uriMatch[0];

      // Fetch the parent post for context
      const parentPost = await service.fetchPostByUri(parentUri);
      const parentContent = parentPost?.details.content || '(could not fetch parent post)';

      // Generate reply
      const prompt = `You are ${runtime.character?.name || 'a Pubky agent'} on the Pubky decentralized network.

Someone posted:
"${parentContent}"

The user wants you to reply to this post. Their instruction: "${text}"

Write a thoughtful, conversational reply (under 280 characters). Output ONLY the reply text.`;

      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
        maxTokens: 200,
        temperature: 0.8,
      });

      const replyContent = typeof response === 'string' ? response.trim() : String(response).trim();
      if (!replyContent) {
        return { success: false, text: 'Could not generate reply' };
      }

      const postId = await service.publishPost(replyContent, false, parentUri, dryRun);

      const resultText = `Replied on Pubky: "${replyContent.slice(0, 100)}${replyContent.length > 100 ? '...' : ''}"`;

      if (callback) {
        await callback({ text: resultText });
      }

      return {
        success: true,
        text: resultText,
        data: { postId, content: replyContent, parentUri },
      };
    } catch (error: any) {
      logger.error('[PUBKY_REPLY] Failed:', error);
      return { success: false, text: `Failed to reply: ${error.message}` };
    }
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Reply to pubky://abc123.../pub/pubky.app/posts/XYZ with something encouraging' } },
      { name: '{{agent}}', content: { text: 'Replying to that post now!', actions: ['PUBKY_REPLY'] } },
    ],
  ],
};
