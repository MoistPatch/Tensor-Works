# Setup

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

## Local development

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and fill in values
cp .env.example .env.local

# 3. Generate Prisma client
pnpm prisma generate

# 4. Run database migrations
pnpm prisma migrate dev

# 5. Start dev server
pnpm dev
```

The app is available at `http://localhost:3000`.

## Environment variables

See `.env.example` for all required variables with descriptions.

The minimum set for local dev:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `RESEND_API_KEY` | Resend API key (use `re_dev_placeholder` for dev with no emails) |
| `HUBSPOT_API_KEY` | HubSpot private app token |
| `HUBSPOT_PORTAL_ID` | HubSpot portal/account ID |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret (use `1x0000000000000000000000000000000AA` for always-pass in dev) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (use `1x00000000000000000000AA` for dev) |
| `JWT_SECRET` | Min 32-character random string |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |
| `NEXT_PUBLIC_SITE_URL` | Full base URL, e.g. `http://localhost:3000` |

## Database setup

The schema is in `prisma/schema.prisma`. Connection URL is configured in `prisma.config.ts` (loaded from `DATABASE_URL`).

```bash
# Apply migrations to a fresh database
pnpm prisma migrate deploy

# Open Prisma Studio
pnpm prisma studio
```

## Admin access

Admin panel is at `/admin`. Authentication is magic-link only.

1. Set `ADMIN_EMAILS` to your email address in `.env.local`
2. Visit `/admin/auth/login`
3. Enter your email — a link will be logged to the dev console (Resend not required locally)

To see the magic link without a real Resend key, temporarily add a `console.log(token)` to `lib/auth.ts:issueMagicLink` during development.
