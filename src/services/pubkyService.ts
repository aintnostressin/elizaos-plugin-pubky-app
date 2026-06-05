import { Service, logger } from '@elizaos/core';
import type { IAgentRuntime } from '@elizaos/core';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import type {
  PubkyAppUser,
  PubkyPluginConfig,
  PubkySession,
  PubkyStorage,
} from '../types.js';
import { ENV } from '../env.js';
import { NexusService, type INexusService } from './nexusService.js';

export type PostsStorage = Pick<PubkyStorage, 'list' | 'stats' | 'getJson'>;

export function extractPostIds(files: string[]): string[] {
  return files
    .map((f: string) => f.replace(/\/$/, '').split('/').pop()!)
    .filter((id: string) => id.length >= 8 && /^[0-9A-Z]+$/i.test(id));
}

export async function checkHasPostedRecently(
  storage: PostsStorage,
  postsPath: string,
  cooldownMinutes: number,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (cooldownMinutes <= 0) return false;
  const cutoffMs = nowMs - cooldownMinutes * 60 * 1000;
  const files = await storage.list(postsPath, null, true, 10);
  if (!files || files.length === 0) return false;
  const ids = extractPostIds(files);
  if (ids.length === 0) return false;
  for (const id of ids) {
    const stat = await storage.stats(`${postsPath}${id}`);
    if (!stat?.lastModifiedMs) continue;
    if (stat.lastModifiedMs <= cutoffMs) break;
    const data = await storage.getJson(`${postsPath}${id}`);
    if (data && !data['parent']) return true;
  }
  return false;
}

export class PubkyService extends Service {
  static serviceType = 'pubky';
  capabilityDescription = 'Pubky homeserver session and social graph integration';

  private pubkyConfig!: PubkyPluginConfig;
  private session: PubkySession | null = null;
  private specsBuilder: any = null;
  private agentPubkyId: string = '';
  private encryptionKey: Buffer | null = null;
  private nexus!: INexusService;

  private static readonly POSTS_PATH = '/pub/pubky.app/posts/';

  private get storage(): PubkyStorage {
    if (!this.session) throw new Error('[PubkyService] Not connected');
    return this.session.storage;
  }

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<PubkyService> {
    const service = new PubkyService(runtime);
    try {
      await service.initialize();
    } catch (error) {
      logger.warn(`[PubkyService] Failed to initialize — Pubky features disabled. ${error}`);
    }
    return service;
  }

  async stop(): Promise<void> {
    logger.info('[PubkyService] Stopped');
  }

  private setting(key: string): string {
    const val = this.runtime.getSetting(key);
    if (val !== null && val !== undefined) return String(val);
    return process.env[key] || '';
  }

  private async initialize(): Promise<void> {
    const seedPhrase = this.setting(ENV.PUBKY_SEED_PHRASE);
    const rawHexKey = this.setting(ENV.PUBKY_SECRET_KEY);
    let secretKey = rawHexKey;

    if (seedPhrase) {
      const { mnemonicToSeedSync, validateMnemonic } = await import('bip39');
      if (!validateMnemonic(seedPhrase)) {
        throw new Error('[PubkyService] PUBKY_SEED_PHRASE is not a valid BIP39 mnemonic');
      }
      const seed = mnemonicToSeedSync(seedPhrase);
      secretKey = Buffer.from(seed.slice(0, 32)).toString('hex');
      logger.info('[PubkyService] Derived secret key from seed phrase');
    }

    this.pubkyConfig = {
      secretKey,
      homeserverPubkey: this.setting(ENV.PUBKY_HOMESERVER_PUBKEY),
      nexusUrl: this.setting(ENV.PUBKY_NEXUS_URL),
    };

    if (!this.pubkyConfig.secretKey || !this.pubkyConfig.homeserverPubkey || !this.pubkyConfig.nexusUrl) {
      throw new Error(
        `[PubkyService] Missing required settings: ${ENV.PUBKY_SEED_PHRASE} (or ${ENV.PUBKY_SECRET_KEY}), ${ENV.PUBKY_HOMESERVER_PUBKEY}, ${ENV.PUBKY_NEXUS_URL}`
      );
    }

    this.encryptionKey = createHash('sha256').update(hexToBytes(this.pubkyConfig.secretKey)).digest();

    await this.connectToHomeserver();
    this.nexus = new NexusService(this.pubkyConfig.nexusUrl, this.agentPubkyId);
    await this.ensureProfileExists();

    logger.info(`[PubkyService] Initialized. Agent ID: ${this.agentPubkyId}`);
  }

  private async connectToHomeserver(): Promise<void> {
    const { Pubky, Keypair, PublicKey } = await import('@synonymdev/pubky');
    const secretKeyBytes = hexToBytes(this.pubkyConfig.secretKey);
    const keypair = Keypair.fromSecret(secretKeyBytes);
    this.agentPubkyId = keypair.publicKey.z32();
    const pubky = new Pubky();
    const signer = pubky.signer(keypair);

    try {
      this.session = await signer.signin();
      logger.info(`[PubkyService] Signed in as ${this.agentPubkyId}`);
    } catch (signinError) {
      if (!this.pubkyConfig.homeserverPubkey) {
        throw new Error(
          `[PubkyService] Sign-in failed and ${ENV.PUBKY_HOMESERVER_PUBKEY} is not set for first-time signup: ${signinError}`
        );
      }
      logger.info(`[PubkyService] Sign-in failed — attempting first-time signup on ${this.pubkyConfig.homeserverPubkey}`);
      const homeserverPk = PublicKey.from(this.pubkyConfig.homeserverPubkey);
      this.session = await signer.signup(homeserverPk, null);
      logger.info(`[PubkyService] Signed up as ${this.agentPubkyId}`);
    }
  }

  private async ensureProfileExists(): Promise<void> {
    try {
      const existing = await this.storage.get('/pub/pubky.app/profile.json');
      if (existing && existing.ok) {
        logger.info('[PubkyService] Profile already exists');
        return;
      }
    } catch { /* doesn't exist yet */ }

    const name = this.runtime.character?.name;
    if (!name || name.length < 3 || name.length > 50) {
      throw new Error(`[PubkyService] Character name "${name}" must be 3–50 characters (got ${name?.length ?? 0})`);
    }
    const bio = typeof this.runtime.character?.bio === 'string'
      ? this.runtime.character.bio
      : Array.isArray(this.runtime.character?.bio)
        ? this.runtime.character.bio[0]
        : undefined;
    if (bio && bio.length > 160) {
      throw new Error(`[PubkyService] Character bio exceeds 160 characters (got ${bio.length})`);
    }
    const profile: PubkyAppUser = { name, bio, status: 'Online' };
    await this.updateProfile(profile);
    logger.info('[PubkyService] Created initial profile');
  }

  // --- Public storage access (for agent-side services) ---

  getStorage(): PubkyStorage {
    if (!this.session) throw new Error('[PubkyService] Not connected');
    return this.session.storage;
  }

  // --- Write operations ---

  private async getSpecsBuilder(): Promise<any> {
    if (!this.specsBuilder) {
      const specs = await import('pubky-app-specs');
      this.specsBuilder = new specs.PubkySpecsBuilder(this.agentPubkyId);
    }
    return this.specsBuilder;
  }

  async publishPost(content: string, isLong: boolean = false, parent?: string): Promise<string> {
    const specs = await import('pubky-app-specs');
    const builder = await this.getSpecsBuilder();
    const kind = isLong ? specs.PubkyAppPostKind.Long : specs.PubkyAppPostKind.Short;
    const { post, meta } = builder.createPost(content, kind, parent ?? null, null, null);
    const path = `/pub/pubky.app/posts/${meta.id}`;

    if (this.setting(ENV.PUBKY_DRY_RUN) === 'true') {
      logger.info(`[PubkyService] DRY RUN — would post to ${path}: ${JSON.stringify(post.toJson())}`);
      return meta.id;
    }

    await this.storage.putJson(path, post.toJson());
    logger.info(`[PubkyService] Post written: ${meta.id}`);
    return meta.id;
  }

  async updateProfile(profile: PubkyAppUser): Promise<void> {
    if (this.setting(ENV.PUBKY_DRY_RUN) === 'true') {
      logger.info(`[PubkyService] DRY RUN — would update profile: ${JSON.stringify(profile)}`);
      return;
    }

    const builder = await this.getSpecsBuilder();
    const { user } = builder.createUser(
      profile.name,
      profile.bio ?? null,
      profile.image ?? null,
      null,
      profile.status ?? null,
    );
    await this.storage.putJson('/pub/pubky.app/profile.json', user.toJson());
  }

  async followUser(userId: string): Promise<void> {
    if (this.setting(ENV.PUBKY_DRY_RUN) === 'true') {
      logger.info(`[PubkyService] DRY RUN — would follow user ${userId}`);
      return;
    }

    const builder = await this.getSpecsBuilder();
    const { follow } = builder.createFollow(userId);
    await this.storage.putJson(`/pub/pubky.app/follows/${userId}`, follow.toJson());
  }

  async tagPost(postId: string, labels: string[]): Promise<void> {
    const builder = await this.getSpecsBuilder();
    const postUri = `pubky://${this.agentPubkyId}/pub/pubky.app/posts/${postId}`;

    if (this.setting(ENV.PUBKY_DRY_RUN) === 'true') {
      logger.info(`[PubkyService] DRY RUN — would tag ${postId} with: ${labels.join(', ')}`);
      return;
    }

    for (const label of labels) {
      try {
        const clean = label.toLowerCase().trim().slice(0, 20);
        if (!clean) continue;
        const { tag, meta } = builder.createTag(postUri, clean);
        await this.storage.putJson(`/pub/pubky.app/tags/${meta.id}`, tag.toJson());
        logger.info(`[PubkyService] Tagged post ${postId} with "${clean}"`);
      } catch (error) {
        logger.error(`[PubkyService] Failed to tag "${label}": ${error}`);
      }
    }
  }

  async deletePost(postId: string): Promise<void> {
    if (this.setting(ENV.PUBKY_DRY_RUN) === 'true') {
      logger.info(`[PubkyService] DRY RUN — would delete post ${postId}`);
      return;
    }

    const path = `/pub/pubky.app/posts/${postId}`;
    await this.storage.delete(path);
    logger.info(`[PubkyService] Post deleted: ${postId}`);
  }

  // --- Read operations (delegated to Nexus) ---

  fetchGlobalFeed(limit?: number) { return this.nexus.fetchGlobalFeed(limit); }
  fetchNotifications() { return this.nexus.fetchNotifications(); }
  fetchPostByUri(uri: string) { return this.nexus.fetchPostByUri(uri); }
  fetchPostKeysByAuthor(authorId: string, limit?: number) { return this.nexus.fetchPostKeysByAuthor(authorId, limit); }
  fetchPostsByIds(postIds: string[]) { return this.nexus.fetchPostsByIds(postIds); }

  getAgentPubkyId(): string { return this.agentPubkyId; }
  getPostsPath(): string { return PubkyService.POSTS_PATH; }
  getNexusUrl(): string { return this.nexus.getUrl(); }
  isConnected(): boolean { return this.session !== null; }

  // --- Encryption (AES-256-GCM) — public for agent-side use ---

  encrypt(data: string): Uint8Array {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey!, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return new Uint8Array(Buffer.concat([iv, tag, encrypted]));
  }

  decrypt(data: Uint8Array): string {
    const buf = Buffer.from(data);
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey!, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8');
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
