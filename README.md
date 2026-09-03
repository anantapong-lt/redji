# Novel Platform

A Thai-first platform for publishing and reading novels and manga. It includes
the reader site, writer tools, an admin console, payments/coins, social
features, and a moderation workflow for text-to-speech narration requests.

## Applications

- `apps/web` — reader and writer-facing Next.js application
- `apps/admin` — Next.js administration console
- `apps/api` — Elysia/Bun API, PostgreSQL access, R2 media storage, and TTS
  request orchestration

## Technology

- Bun workspaces and TypeScript
- Next.js App Router for Web and Admin
- ElysiaJS with Kysely and PostgreSQL for the API
- Redis for rate limiting and background-job coordination
- Cloudflare R2 for uploaded media and published audio

## Local development

Prerequisites: Bun, PostgreSQL, Redis, and the environment variables required
by each app. Do not commit `.env` files or production credentials.

```powershell
bun install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/admin/.env.example apps/admin/.env.local
bun run dev
```

This starts the local apps on their development ports:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Admin: `http://localhost:3002`

Run database migrations when setting up a new API database:

```powershell
bun run --cwd apps/api migrate
```

## Configuration and Cloudflare R2

The tracked examples list every connection that a new environment needs:

- `apps/api/.env.example` — PostgreSQL, Redis, JWT secrets, allowed browser
  origins, R2, email, payment webhook, and server-side TTS settings
- `apps/web/.env.example` — public API/site/admin URLs and the public media
  origin for the reader app
- `apps/admin/.env.example` — public API/reader URLs and the public media
  origin for the admin app

For R2, create a bucket and a scoped S3 API key with read/write access to that
bucket only. Put its endpoint, key ID, secret, bucket name, and the public
media URL into the API environment. The browser applications never receive an
R2 secret. Give Web and Admin `NEXT_PUBLIC_R2_PUBLIC_URL` with that same public
media URL (or its custom media domain). It is not an API endpoint or a secret:
the apps use it solely to allow the one expected media host in their browser
security policy and image configuration.

In Railway, set API secrets only on the API service. Set `NEXT_PUBLIC_*` URLs
on Web/Admin **before building** those services, because Next.js embeds them
in the browser bundle and uses the API URL in its Content Security Policy.
Use the deployed Web and Admin URLs as `FRONTEND_URL` and `ADMIN_URL` on the
API so credentialed CORS remains restricted to the real applications.

## TTS

Basic TTS requests are managed through the API and rendered by the separate
`TTSCore` worker repository. Pro TTS voice mapping is prepared behind an
explicit feature gate and should remain disabled until reference voices and an
end-to-end render test have been approved.

The worker needs the same `DATABASE_URL` and R2 connection as the API, plus a
CUDA-capable GPU and ffmpeg. Its tracked `.env.example` documents the worker
settings and safe defaults; see the TTSCore README before starting it against
any non-local database.

## Repository hygiene

Personal design notes and working documents belong in `note for developing/`.
That directory is intentionally ignored and never uploaded to GitHub.

# redji
