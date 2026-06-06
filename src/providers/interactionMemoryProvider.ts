import type { Provider, IAgentRuntime, Memory } from '@elizaos/core';
import { PubkyService } from '../services/pubkyService.js';

/**
 * Provider that surfaces the agent's past Pubky interactions (posts, replies,
 * follows, deletions) into the LLM context via runtime.getMemories().
 */
export const interactionMemoryProvider: Provider = {
  name: 'PUBKY_INTERACTION_MEMORY',
  description: 'Provides the agent\'s past Pubky interactions (posts, replies, follows, deletes) from runtime memory',
  dynamic: true,
  position: 30,

  get: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<PubkyService>('pubky');
    if (!service || !service.isConnected()) {
      return { text: '', data: { interactions: [] } };
    }

    try {
      const memories = await runtime.getMemories({
        roomId: _message.roomId,
        count: 20,
        unique: true,
        tableName: 'custom_memories',
      });

      const pubkyMemories = memories?.filter(
        (m) => (m.metadata as { source?: string })?.source === 'pubky',
      ) ?? [];

      if (pubkyMemories.length === 0) {
        return {
          text: 'Pubky Interaction History: No previous interactions recorded.',
          data: { interactions: [] },
        };
      }

      const lines = pubkyMemories.map((m) => {
        const meta = m.metadata as Record<string, unknown>;
        const action = (meta.action as string) ?? 'unknown';
        const target = (meta.target as string) ?? '';
        const timestamp = (meta.timestamp as number) ?? (m.createdAt ?? Date.now());
        const date = new Date(timestamp).toISOString();
        const content = (m.content as { text?: string })?.text ?? '';
        return `[${action.toUpperCase()}] ${date} → ${target}: ${content.slice(0, 120)}`;
      });

      return {
        text: `Pubky Interaction History (last ${pubkyMemories.length}):\n${lines.join('\n')}`,
        data: { interactions: pubkyMemories },
      };
    } catch (error) {
      return {
        text: `Pubky Interaction History: Unable to retrieve interactions.`,
        data: { interactions: [] },
      };
    }
  },
};
