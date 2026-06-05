import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { logger, ModelType } from '@elizaos/core';
import { ENV } from '../env.js';
import { PubkyService } from '../services/pubkyService.js';

const getDryRun = (runtime: IAgentRuntime): boolean => {
  return (runtime.getSetting(ENV.PUBKY_DRY_RUN) ?? process.env[ENV.PUBKY_DRY_RUN]) === 'true';
};

export const createPostAction: Action = {
  name: 'PUBKY_CREATE_POST',
  similes: ['POST_TO_PUBKY', 'PUBKY_POST', 'PUBLISH_POST', 'CREATE_PUBKY_POST'],
  description: 'Create and publish a new post on the Pubky decentralized social network',

  validate: async (runtime: IAgentRuntime, _message: Memory): Promise<boolean> => {
    const service = runtime.getService<PubkyService>('pubky');
    if (!service || !service.isConnected()) {
      logger.warn('[PUBKY_CREATE_POST] PubkyService not available or not connected');
      return false;
    }
    return true;
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
      // If the user provided specific content to post, use it
      const userText = message.content?.text || '';
      let postContent: string;

      if (userText.toLowerCase().includes('post:') || userText.toLowerCase().includes('publish:')) {
        // Extract content after "post:" or "publish:" directive
        const match = userText.match(/(?:post|publish):\s*(.+)/is);
        postContent = match ? match[1].trim() : '';
      } else {
        // Generate content using LLM
        const feed = await service.fetchGlobalFeed(5);
        const feedContext = feed
          .map((p) => `- ${p.details.content.slice(0, 100)}`)
          .join('\n');

        const topics = runtime.character?.topics?.join(', ') || 'geopolitics';
        const prompt = `${runtime.character?.system || ''}

The user asked you to create a post. Their message: "${userText}"

${feedContext ? `Recent network activity:\n${feedContext}\n` : ''}
Write an engaging post (under 280 characters) about your topics (${topics}). Output ONLY the post text, nothing else.`;

        const response = await runtime.useModel(ModelType.TEXT_SMALL, {
          prompt,
          maxTokens: 200,
          temperature: 0.9,
        });
        const raw = typeof response === 'string' ? response.trim() : String(response).trim();
        postContent = raw.replace(/^["']+|["']+$/g, '');
      }

      if (!postContent || postContent.length === 0) {
        return { success: false, text: 'Could not generate post content' };
      }

      const isLong = postContent.length > 2000;
      const postId = await service.publishPost(postContent, isLong, undefined, dryRun);

      const resultText = `Published post on Pubky: "${postContent.slice(0, 100)}${postContent.length > 100 ? '...' : ''}"`;

      if (callback) {
        await callback({ text: resultText });
      }

      return {
        success: true,
        text: resultText,
        data: { postId, content: postContent, isLong },
      };
    } catch (error: any) {
      logger.error('[PUBKY_CREATE_POST] Failed:', error);
      return { success: false, text: `Failed to create post: ${error.message}` };
    }
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Post something about decentralization on Pubky' } },
      { name: '{{agent}}', content: { text: 'Creating a post on Pubky!', actions: ['PUBKY_CREATE_POST'] } },
    ],
    [
      { name: '{{user}}', content: { text: 'publish: The future is decentralized and open.' } },
      { name: '{{agent}}', content: { text: 'Publishing your post to Pubky now.', actions: ['PUBKY_CREATE_POST'] } },
    ],
  ],
};
