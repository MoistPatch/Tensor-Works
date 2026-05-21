# tensorworks-web

Marketing website for TensorWorks — Australian AI compute infrastructure for research institutions, enterprises, and government.

Production URL: `https://tensorworks.online`

## Stack

- **Framework**: Next.js 16 (App Router, React 19, Turbopack)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4 (CSS-config, no `tailwind.config.js`)
- **Database**: PostgreSQL via Prisma 7 with `@prisma/adapter-pg`
- **Forms**: react-hook-form + Zod v4
- **CRM**: HubSpot Private App
- **Transactional email**: Resend
- **Marketing email**: Mailchimp Marketing API v3
- **Captcha**: Cloudflare Turnstile
- **Analytics**: Google Analytics 4 (consent-gated)
- **Deployment**: Netlify (`netlify.toml` at repo root)
- **Worker**: Separate BullMQ/IORedis package in `worker/` — see `docs/WORKER.md`

## Local development

```bash
pnpm install
cp .env.example .env.local
# Fill in env vars — at minimum DATABASE_URL, RESEND_API_KEY, HUBSPOT_API_KEY, TURNSTILE_SECRET_KEY
pnpm dlx prisma migrate dev
pnpm dev
```

Site runs at `http://localhost:3000`.

## Common commands

```bash
pnpm dev            # Next.js dev server
pnpm build          # prisma generate && next build (production)
pnpm start          # serve the built output
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm format         # Prettier
pnpm seed:news      # seed NewsSource table
pnpm seed:editorial # seed EditorialCalendar
pnpm mailchimp:setup # idempotent Mailchimp segment + journey setup
pnpm import:cold    # import cold outbound CSV
```

## Project layout

```
app/                      Next.js app router routes
  (marketing)/            Public site (home, solutions, hardware, services, about, contact, insights)
  api/                    Server routes: /rfq, /newsletter, /mailchimp/webhook, /health
  layout.tsx              Root layout (organisation JSON-LD, consent-gated GA)
  sitemap.ts              Dynamic sitemap (static + blog posts)
  robots.ts               Robots.txt generator
components/
  analytics/              CookieConsent banner + GoogleAnalytics with consent gate
  layout/                 Header, Footer, MobileNav
  newsletter/             SignupForm (compact + full variants)
  rfq/                    Multi-step RFQ form
  insights/               PostBody, PostCard, RelatedPosts
  ui/                     shadcn-style primitives
content/                  Static content data (solutions, hardware, services, SEO)
emails/                   react-email templates (transactional + marketing)
lib/                      env, prisma, hubspot, resend, mailchimp, validations, jsonLd, qualityGate
prisma/                   Schema (no admin models — site-only)
worker/                   Separate package — BullMQ jobs (see docs/WORKER.md)
docs/                     DEPLOY, SETUP, CONTENT, COMPLIANCE, WORKER
```

## Documentation

- [docs/DEPLOY.md](docs/DEPLOY.md) — Netlify deployment, env vars, DNS, troubleshooting
- [docs/SETUP.md](docs/SETUP.md) — Step-by-step third-party service setup
- [docs/CONTENT.md](docs/CONTENT.md) — Editorial engine operations
- [docs/COMPLIANCE.md](docs/COMPLIANCE.md) — Spam Act / Privacy Act / copyright posture
- [docs/WORKER.md](docs/WORKER.md) — Worker package deployment (BullMQ jobs)

## Notable design decisions

- **No admin dashboard** — operator workflows are CLI scripts and direct DB access (psql)
- **No prices on the site** — every engagement is RFQ-scoped
- **Australian English throughout** — organisation, centre, behaviour, fortnightly
- **Worker is a separate package** — Netlify functions are stateless and can't run BullMQ; worker deploys to its own VPS or container platform
- **Cookie consent gates analytics only** — necessary cookies (session, form, consent) load unconditionally
- **`prisma.config.ts` has a dummy DB URL fallback** — so `prisma generate` works in CI without a live database
