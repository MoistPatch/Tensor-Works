# Deployment

## Production stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Next.js 16 (standalone output) |
| Database | PostgreSQL 15 |
| Reverse proxy | Caddy 2 (automatic HTTPS) |
| Process manager | Docker Compose |

## Quick deploy

```bash
# On the server
git clone <repo> tensorworks-web
cd tensorworks-web/tensorworks-web

# Copy and fill in production env
cp .env.example .env.production
nano .env.production

# Build and start
docker compose up -d --build
```

## Required environment variables for production

All variables in `.env.example` are required. Key differences from dev:

- `DATABASE_URL` — PostgreSQL connection string to your production database
- `NEXT_PUBLIC_SITE_URL` — Your actual domain, e.g. `https://tensorworks.com.au`
- `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — Production Turnstile keys from Cloudflare dashboard
- `RESEND_API_KEY` — Live Resend key
- `FROM_EMAIL` — Must be a verified sender domain in Resend
- `HUBSPOT_API_KEY` — Production private app token with contacts + deals scope
- `JWT_SECRET` — Min 32-char random string, e.g. `openssl rand -hex 32`
- `ADMIN_EMAILS` — Production admin email(s)
- `NEXT_PUBLIC_GA_ID` — Google Analytics measurement ID (optional)

## Database migrations

Run migrations before starting the app:

```bash
DATABASE_URL=<prod_url> pnpm prisma migrate deploy
```

Or inside Docker:

```bash
docker compose exec web pnpm prisma migrate deploy
```

## Caddy configuration

Place `Caddyfile` in the project root. Example:

```caddyfile
tensorworks.com.au {
    reverse_proxy web:3000
    encode zstd gzip
}

www.tensorworks.com.au {
    redir https://tensorworks.com.au{uri} permanent
}
```

## Health check

The app does not expose a `/health` endpoint yet. Monitor `/api/rfq` with a HEAD request — a 405 response confirms the server is alive.

## Rollback

```bash
# Roll back to previous image
docker compose down
docker compose up -d --no-build <previous-tag>
```
