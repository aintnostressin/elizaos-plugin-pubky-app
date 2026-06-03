/** Pubky App data model types matching pubky-app-specs */

export interface PubkyStorage {
  get(path: string): Promise<Response>;
  getBytes(path: string): Promise<Uint8Array>;
  putBytes(path: string, data: Uint8Array): Promise<void>;
  putJson(path: string, data: any): Promise<void>;
  getJson(path: string): Promise<any>;
  list(path: string, cursor?: string | null, reverse?: boolean | null, limit?: number | null, shallow?: boolean | null): Promise<string[]>;
  stats(path: string): Promise<{ lastModifiedMs?: number } | undefined>;
  delete(path: string): Promise<void>;
}

export interface PubkySession {
  storage: PubkyStorage;
}

export interface PubkyAppUser {
  name: string;
  bio?: string;
  image?: string;
  links?: PubkyAppUserLink[];
  status?: string;
}

export interface PubkyAppUserLink {
  title: string;
  url: string;
}

export type PostKind = 'short' | 'long' | 'image' | 'video' | 'link' | 'file';

export interface PubkyAppPost {
  content: string;
  kind: PostKind;
  parent?: string;
  embed?: PostEmbed;
  attachments?: string[];
}

export interface PostEmbed {
  uri: string;
  content: string;
}

export interface PubkyAppFollow {
  created_at: number;
}

export interface PubkyAppTag {
  uri: string;
  label: string;
  created_at: number;
}

/** Nexus API response types */

export interface NexusPostEntry {
  details: {
    id: string;
    author: string;
    content: string;
    kind: PostKind;
    indexed_at: number;
    uri: string;
  };
  counts?: {
    tags: number;
    replies: number;
    reposts: number;
  };
}

export interface NexusUserDetails {
  id: string;
  name: string;
  bio?: string;
  image?: string;
  status?: string;
}

export interface NexusNotification {
  timestamp: number;
  body: {
    type: string;
    // mention
    mentioned_by?: string;
    post_uri?: string;
    // reply
    replied_by?: string;
    parent_post_uri?: string;
    reply_uri?: string;
    // tag
    tagged_by?: string;
    tag_label?: string;
  };
}

/** Plugin configuration */

export interface PubkyPluginConfig {
  secretKey: string;
  homeserverPubkey: string;
  nexusUrl: string;
}

