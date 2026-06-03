import type { Provider, IAgentRuntime, Memory } from '@elizaos/core';
import { PubkyService } from '../services/pubkyService.js';

export const notificationsProvider: Provider = {
  name: 'PUBKY_NOTIFICATIONS',
  description: 'Provides recent mentions, replies, and follows directed at the agent from Nexus',
  dynamic: true,
  position: 40,

  get: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<PubkyService>('pubky');
    if (!service || !service.isConnected()) {
      return { text: '', data: { notifications: [] } };
    }

    const notifications = await service.fetchNotifications();

    if (notifications.length === 0) {
      return {
        text: 'Pubky Notifications: No new notifications.',
        data: { notifications: [] },
      };
    }

    const lines = notifications.slice(0, 10).map((n) => {
      const from = (n.body.mentioned_by || n.body.replied_by || n.body.tagged_by || '?').slice(0, 12);
      const type = n.body.type;
      const detail = n.body.post_uri ? ` (${n.body.post_uri.slice(-20)})` : '';
      return `[${type}] from ${from}...${detail}`;
    });

    return {
      text: `Pubky Notifications:\n${lines.join('\n')}`,
      data: { notifications },
    };
  },
};
