# Deployment

The TensorWorks site is deployed to Netlify from the `main` branch.

## Architecture

| Component | Location | Notes |
|-----------|----------|-------|
| Marketing site (Next.js 16) | Netlify | This package — `tensorworks-web/` |
| Worker (BullMQ jobs) | Separate VPS | `worker/` package, see `docs/WORKER.md` |
| PostgreSQL | Managed (Neon / Supabase / RDS) | Connection string in `DATABASE_URL` |
| Redis | Managed (Upstash) or worker VPS | Only consumed by worker — not by Netlify |
| Email | Resend (transactional) + Mailchimp (marketing) | |
| CRM | HubSpot | |
| Captcha | Cloudflare Turnstile | |
| DNS | Cloudflare or registrar | A record points to Netlify |

## Netlify configuration

`/netlify.toml` at the repo root defines the build:

```toml
[build]
  base    = "tensorworks-web"
  command = "pnpm build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

`pnpm build` runs `prisma generate && next build`. The Prisma client is generated against the schema regardless of whether `DATABASE_URL` resolves — `prisma.config.ts` falls back to a dummy URL so CI builds work without a live DB.

## Environment variables

Set every variable from `.env.example` in **Site settings → Environment variables** in the Netlify dashboard.

Required at build time:
- `NEXT_PUBLIC_SITE_URL` — `https://tensorworks.online`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — Cloudflare Turnstile public key
- `NEXT_PUBLIC_GA_ID` — GA4 measurement ID (optional; if unset, GA does not load)

Required at runtime (server-side routes / API):
- `DATABASE_URL` — PostgreSQL connection string
- `RESEND_API_KEY` — Resend transactional email
- `FROM_EMAIL`, `NOTIFICATION_EMAIL`
- `HUBSPOT_API_KEY`, `HUBSPOT_PORTAL_ID`
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile server-side secret
- `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX`, `MAILCHIMP_AUDIENCE_ID` (if email marketing is in use)
- `MAILCHIMP_WEBHOOK_SECRET` — random string matching the Mailchimp webhook URL query param

Optional:
- `COMPANY_NAME`, `COMPANY_ABN`, `COMPANY_ADDRESS` — override defaults

## DNS

Point your domain at Netlify per their docs. Netlify provisions Let's Encrypt TLS automatically. Force HTTPS in **Domain management → HTTPS**.

## First deploy

1. Push to `main` — Netlify auto-detects the commit and starts a build
2. Watch the build log for the route table; confirm `/` is present (not just sub-routes)
3. Hit `https://tensorworks.online/api/health` — should return 200 with database `ok`
4. Hit `https://tensorworks.online/sitemap.xml` — should include all 16+ URLs plus any published posts
5. Hit `https://tensorworks.online/robots.txt` — should reference the production sitemap URL

## Subsequent deploys

```bash
git push origin main
```

Netlify rebuilds. Rollback via **Deploys → click previous deploy → Publish deploy**.

## Database migrations

Run from a dev machine pointed at production `DATABASE_URL`:

```bash
DATABASE_URL=<prod-url> pnpm dlx prisma migrate deploy
```

Run inside a connection pool maintenance window if the migration is non-trivial.

## Health check

`GET /api/health` returns:
```json
{
  "status": "ok",
  "timestamp": "...",
  "checks": {
    "app": { "status": "ok" },
    "database": { "status": "ok", "latencyMs": 12 },
    "redis": { "status": "skipped" }
  }
}
```

`status` becomes `degraded` and the HTTP code becomes 503 if any check fails. Wire to your uptime monitor (e.g. UptimeRobot, BetterUptime) with a 5-minute interval.

## Worker deployment

The worker (BullMQ-based content generation, email sends, news monitoring) does NOT run on Netlify — Netlify functions are stateless and can't run BullMQ. Deploy the worker separately. See `docs/WORKER.md`.

## Troubleshooting

**Build fails with `Cannot find module '@prisma/client'`**
→ `pnpm install` didn't run cleanly. Check the Netlify build log; usually a `pnpm-lock.yaml` conflict.

**Build fails with TypeScript error in `lib/mailchimp.ts`**
→ `@mailchimp/mailchimp_marketing` not installed; run `pnpm install` locally and commit lockfile.

**TLS errors after DNS cutover**
→ Netlify TLS provision can take 5–10 minutes; check **Domain management → HTTPS** for status.

**Routes return 404 immediately after deploy**
→ Check the **Deploys** tab for the published deploy; you may be looking at a deploy preview URL.

**`/admin` returns 200**
→ Should never happen; the admin route was deleted. If it appears, check git log for an accidental reintroduction.
