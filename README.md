# LineChat

A private, secure, invite-only Android chat application using "The Bridge Method" for media handling.

## Architecture

- **Frontend**: Native Android (Kotlin + Jetpack Compose)
- **Backend**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Media Storage**: Temporary D1 BLOBs -> Local Android Device Storage

## Setup Instructions

### Backend
1. Navigate to `/backend`.
2. Install dependencies: `npm install`.
3. Create D1 database: `npx wrangler d1 create linechat-db`.
4. Update `wrangler.toml` with the new database ID.
5. Apply schema: `npx wrangler d1 execute linechat-db --file=./schema.sql`.
6. Deploy: `npx wrangler deploy`.

### Android
1. Open `/android` in Android Studio.
2. Sync Project with Gradle Files.
3. Update `ChatRepository.kt` with your deployed Worker URL.
4. Build and Run on a device/emulator.

## Features
- **Atomic Invite System**: One key, one user. Race-condition proof.
- **Privacy Wall**: Admin cannot read messages.
- **Auto-Cleanup**: Media blobs on server are deleted after 24 hours.
