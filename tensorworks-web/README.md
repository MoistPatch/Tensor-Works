# tensorworks-web

Marketing website for TensorWorks — Australian AI compute infrastructure.

Built with Next.js 16, TypeScript, Tailwind CSS v4, Prisma 7, Resend, HubSpot, and Cloudflare Turnstile.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # fill in values
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev
```

See [docs/SETUP.md](docs/SETUP.md) for full setup instructions.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| UI components | Radix UI + class-variance-authority |
| Database | PostgreSQL 15 + Prisma 7 |
| ORM adapter | `@prisma/adapter-pg` |
| Email | Resend + react-email |
| CRM | HubSpot (contacts + deals on RFQ submit) |
| Spam protection | Cloudflare Turnstile |
| Auth | Magic-link email (admin only) |

## Project structure

```
app/
  (marketing)/          Marketing pages (public)
  (admin)/              Admin panel (magic-link protected)
  api/                  Route handlers (rfq, rfq/draft, admin/auth)
components/
  brand/                LogoMark, LogoHorizontal, LogoVertical
  layout/               Header, Footer, MobileNav
  rfq/                  Multi-step RFQ form components
  ui/                   Button, Input, Card, Badge, etc.
content/                TypeScript content files (solutions, hardware, services, seo)
docs/                   SETUP, DEPLOY, CONTENT, COMPLIANCE guides
emails/transactional/   react-email HTML email templates
lib/                    Prisma client, env, auth, hubspot, resend, audit, validation
prisma/                 schema.prisma + migrations
```

## Documentation

- [Setup guide](docs/SETUP.md)
- [Deployment](docs/DEPLOY.md)
- [Content management](docs/CONTENT.md)
- [Compliance notes](docs/COMPLIANCE.md)

## Admin panel

`/admin` — magic-link authentication. Set `ADMIN_EMAILS` in env.
