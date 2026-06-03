import type { Plugin } from '@elizaos/core';
import { ENV } from './env.js';
import { PubkyService } from './services/pubkyService.js';
import { createPostAction } from './actions/createPost.js';
import { replyToPostAction } from './actions/replyToPost.js';
import { followUserAction } from './actions/followUser.js';
import { deletePostAction } from './actions/deletePost.js';
import { feedProvider } from './providers/feedProvider.js';
import { notificationsProvider } from './providers/notificationsProvider.js';

export const pubkyPlugin: Plugin = {
  name: 'plugin-pubky',
  description: 'Pubky decentralized social network integration — post, reply, follow, and monitor mentions',

  services: [PubkyService],

  actions: [
    createPostAction,
    replyToPostAction,
    followUserAction,
    deletePostAction,
  ],

  providers: [
    feedProvider,
    notificationsProvider,
  ],
};

export default pubkyPlugin;

// Re-export components for direct usage
export { PubkyService, checkHasPostedRecently, extractPostIds } from './services/pubkyService.js';
export { createPostAction } from './actions/createPost.js';
export { replyToPostAction } from './actions/replyToPost.js';
export { followUserAction } from './actions/followUser.js';
export { deletePostAction } from './actions/deletePost.js';
export { feedProvider } from './providers/feedProvider.js';
export { notificationsProvider } from './providers/notificationsProvider.js';
export * from './types.js';
