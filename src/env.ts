export const ENV = {
  // Required
  PUBKY_SEED_PHRASE: 'PUBKY_SEED_PHRASE',
  PUBKY_SECRET_KEY: 'PUBKY_SECRET_KEY',
  PUBKY_HOMESERVER_PUBKEY: 'PUBKY_HOMESERVER_PUBKEY',
  PUBKY_NEXUS_URL: 'PUBKY_NEXUS_URL',

  // Optional — skip actual homeserver writes
  PUBKY_DRY_RUN: 'PUBKY_DRY_RUN',
} as const;

export type EnvKey = keyof typeof ENV;
