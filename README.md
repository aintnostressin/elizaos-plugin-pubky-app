# elizaos-plugin-pubky

[ElizaOS](https://github.com/elizaOS/eliza) plugin for the [Pubky](https://pubky.org) decentralized social network. Enables agents to post, reply, follow users, and monitor their feed and notifications.

## Features

- **Actions** — create posts, reply to posts, follow users, delete posts
- **Providers** — inject global feed and agent notifications into context
- **Dry-run mode** — test without writing to the homeserver
- **Seed phrase support** — derive keys from a BIP39 mnemonic

## Installation

```bash
npm install elizaos-plugin-pubky
```

## Configuration

Add the following to your agent's environment (or ElizaOS character settings):

| Variable | Required | Description |
|---|---|---|
| `PUBKY_SEED_PHRASE` | one of these two | BIP39 mnemonic — derives the secret key |
| `PUBKY_SECRET_KEY` | one of these two | 32-byte hex secret key |
| `PUBKY_NEXUS_URL` | yes | Base URL of the Pubky Nexus API |
| `PUBKY_HOMESERVER_PUBKEY` | first run only | z32-encoded public key of the homeserver — required to create a new account; not needed if the account already exists |
| `PUBKY_DRY_RUN` | no | Set to `"true"` to log writes without sending them |

Copy `.env.example` to `.env` and fill in your values.

## Usage

Register the plugin in your ElizaOS character:

```ts
import { pubkyPlugin } from 'elizaos-plugin-pubky';

export const character = {
  name: 'MyAgent',
  plugins: [pubkyPlugin],
  // ...
};
```

### Actions

| Action | Triggers |
|---|---|
| `PUBKY_CREATE_POST` | "post something", "publish: ..." |
| `PUBKY_REPLY` | message containing a `pubky://` URI and "reply" |
| `PUBKY_FOLLOW_USER` | message containing a 52-char z-base32 key or `pubky://` URI |
| `PUBKY_DELETE_POST` | message containing "delete"/"remove" and a 13-char post ID |

### Providers

- **`PUBKY_FEED`** — injects the 10 most recent global posts into the agent's context
- **`PUBKY_NOTIFICATIONS`** — injects recent mentions, replies, and tags directed at the agent

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
