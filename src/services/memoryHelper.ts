import type { IAgentRuntime, Memory, Content } from '@elizaos/core';
import { logger, MemoryType, asUUID } from '@elizaos/core';

/** Metadata attached to every Pubky interaction memory */
export interface PubkyInteractionMetadata {
  source: 'pubky';
  action: 'post' | 'reply' | 'follow' | 'delete';
  target: string;
  timestamp: number;
}

/**
 * Create a memory record for a Pubky interaction so the agent can recall
 * past posts, replies, follows, and deletions in future conversations.
 *
 * @param runtime — the ElizaOS runtime
 * @param roomId — the room to attach the memory to
 * @param entityId — the agent/entity that performed the action
 * @param text — human-readable summary of the interaction
 * @param metadata — structured metadata about the action
 */
export async function createInteractionMemory(
  runtime: IAgentRuntime,
  roomId: string,
  entityId: string,
  text: string,
  metadata: Omit<PubkyInteractionMetadata, 'source' | 'timestamp'> & Partial<Pick<PubkyInteractionMetadata, 'timestamp'>>,
): Promise<void> {
  const memory: Memory = {
    id: asUUID(crypto.randomUUID()),
    entityId: asUUID(entityId),
    agentId: runtime.agentId,
    roomId: asUUID(roomId),
    content: {
      text,
      source: 'pubky',
    } as Content,
    createdAt: Date.now(),
    metadata: {
      type: MemoryType.CUSTOM,
      source: 'pubky',
      action: metadata.action,
      target: metadata.target,
      timestamp: metadata.timestamp ?? Date.now(),
    },
  };

  try {
    await runtime.createMemory(memory, 'custom_memories');
    logger.info(`[memoryHelper] Created interaction memory: ${metadata.action} → ${metadata.target}`);
  } catch (error) {
    logger.error(`[memoryHelper] Failed to create interaction memory: ${error}`);
  }
}
