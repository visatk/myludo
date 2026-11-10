# AGENTS.md — Royal Ludo Arena (Telegram Mini App)

## Architecture Overview
Royal Ludo Arena is a real-time multiplayer Ludo Telegram Mini App supporting two complementary serverless runtimes:

1. **Cloudflare Workers + Durable Objects (`cf` CLI & `cloudflare.config.ts`)**:
   - **Worker Entrypoint (`src/index.ts`)**: Hono API router, Telegram Mini App `initData` authentication (`HMAC-SHA256` & `Ed25519` third-party signature validation), `Telegram.WebApp.Serverless.call` endpoint compatibility (`POST /api/:endpointName`), and PartyServer WebSocket routing (`/parties/*`).
   - **`LudoRoom` Durable Object (`src/worker/ludo-room.ts`)**: Real-time 2–4 player stateful Ludo table using PartyServer and DO Alarms for turn/dice/bot timers.
   - **`MatchmakingCoordinator` Durable Object (`src/worker/matchmaking-coordinator.ts`)**: Global SQLite-backed (`this.ctx.storage.sql`) matchmaking registry, player ELO/coin/gem profiles, 24-hour daily chest cooldowns, and Apirone multi-currency crypto treasury (`src/worker/apirone.ts`).
2. **Telegram Serverless (`tgcloud` CLI & `tgcloud.jsonc`)**:
   - **`tgcloud/schema.js`**: Drizzle-style SQLite schema (`sdk/db`) for `users`, `rooms`, and `invoices` (no foreign keys, explicit indexes on query columns).
   - **`tgcloud/handlers/`**: Bot update handlers (`message.js`, `callback_query.js`) using `sdk/api` and `sdk/db`.
   - **`tgcloud/endpoints/`**: Mini App endpoints (`getProfile.js`, `claimDailyReward.js`, `listLobby.js`, `matchmaking.js`, `createInvoice.js`) invoked via `Telegram.WebApp.Serverless.call(name, input, cb)`.

## Cloudflare (`cf` CLI) Workflow
This project uses `cloudflare.config.ts` and Cloudflare's `cf` CLI (`@cloudflare/cli`). **Do not create a `wrangler.toml` or `wrangler.jsonc` file.**

- **Local Development**: `npm run dev` (`cf dev`) — loads secrets from `.dev.vars` (copied from `.dev.vars.example`).
- **Type Generation & Typecheck**: `npm run typecheck` (`cf workers types && tsc`). Run this after any change to `cloudflare.config.ts` or TypeScript sources.
- **Production Build**: `npm run build` (`cf build`).
- **Deploy to Cloudflare**: `npx cf deploy`.

## Telegram Serverless (`tgcloud` CLI) Workflow
- **Local Development**: `tgcloud dev` (runs handlers, Mini App endpoints, and local SQLite).
- **Database Migrations**: `tgcloud db generate` and `tgcloud db migrate --local` (or `--remote`).
- **Build & Deploy Mini App + Bot**: `npm run build && tgcloud deploy`.

## Security & Best Practices
- Always validate Telegram Mini App `initData` on the server (`src/worker/telegram-auth.ts`) using constant-time digest comparison (`crypto.subtle.timingSafeEqual`) and `auth_date` freshness checks.
- Never hardcode secrets in `cloudflare.config.ts` or `tgcloud.jsonc`; use `bindings.secret()` + `.dev.vars` (Cloudflare) or `tgcloud secret set` (Telegram Serverless).
- Use Web Crypto (`crypto.getRandomValues` / `crypto.randomUUID`) instead of `Math.random()` for dice rolls, room codes, and IDs.
