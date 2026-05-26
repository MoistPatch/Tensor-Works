# Operations Setup

Step-by-step setup for every third-party service the site depends on. Follow in order — later steps reference earlier values.

## 1. Domain and DNS

- Register `tensorworks.online` (or your domain) with your preferred registrar
- Point DNS at Netlify per Netlify's "Add a custom domain" docs
- Enable HTTPS in **Netlify → Domain management → HTTPS**

## 2. PostgreSQL

Pick a managed Postgres provider that supports a connection string and SSL:

- **Neon** (recommended for low cost) — `https://neon.tech`
- **Supabase** — `https://supabase.com` (free tier available)
- **AWS RDS / Google Cloud SQL** — for larger scale

Create a database, copy the connection string into `DATABASE_URL`. Run migrations from a dev machine:

```bash
DATABASE_URL=<prod-url> pnpm dlx prisma migrate deploy
```

## 3. Resend (transactional email)

1. Create account at `https://resend.com`
2. Add and verify your sending domain (`tensorworks.online`)
3. Add the DNS records Resend provides (SPF, DKIM)
4. Generate an API key under **API Keys**
5. Set `RESEND_API_KEY`, `FROM_EMAIL=sales@tensorworks.online`, `NOTIFICATION_EMAIL=sam@tensorworks.online,sales@tensorworks.online`

## 4. HubSpot CRM

1. Create a HubSpot account (free tier OK)
2. Settings → Integrations → Private apps → Create
3. Scopes required: `crm.objects.contacts.read/write`, `crm.objects.deals.read/write`
4. Copy the token into `HUBSPOT_API_KEY`
5. Find your portal ID under Settings → Account & Billing — `HUBSPOT_PORTAL_ID`

## 5. Cloudflare Turnstile

1. Cloudflare dashboard → Turnstile → Add site
2. Domain: `tensorworks.online` (and any preview subdomains)
3. Widget mode: Managed
4. Copy site key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
5. Copy secret key → `TURNSTILE_SECRET_KEY`

## 6. Mailchimp (newsletter)

1. Create Mailchimp account
2. Audience → Create new audience (e.g. "TensorWorks Insights")
3. Copy audience ID → `MAILCHIMP_AUDIENCE_ID`
4. Account → Extras → API keys → Create → `MAILCHIMP_API_KEY`
5. Server prefix is the suffix of the API key (e.g. `us21`) → `MAILCHIMP_SERVER_PREFIX`
6. Verify sending domain (same DKIM record as Resend can be reused per domain)
7. Run `pnpm mailchimp:setup` to create segment tags and the welcome journey
8. Configure webhook: Audience → Settings → Webhooks → New webhook
   - URL: `https://tensorworks.online/api/mailchimp/webhook?secret=<MAILCHIMP_WEBHOOK_SECRET>`
   - Events: Subscribes, Unsubscribes, Cleaned, Profile updates, Campaign

## 7. Google Analytics 4 (optional)

1. Create GA4 property at `https://analytics.google.com`
2. Web data stream for `tensorworks.online`
3. Copy measurement ID (`G-XXXXXXX`) → `NEXT_PUBLIC_GA_ID`
4. The site loads GA only after the cookie consent banner is accepted

## 8. Google Search Console

1. Add `tensorworks.online` as a property at `https://search.google.com/search-console`
2. Verify via DNS TXT record
3. Submit sitemap: `https://tensorworks.online/sitemap.xml`

## 9. Anthropic API (worker only)

Required only if you deploy the content generation worker.

1. Create account at `https://console.anthropic.com`
2. Settings → API keys → Create → `ANTHROPIC_API_KEY`
3. Set a billing limit
4. `MONTHLY_AI_BUDGET_AUD=500` in worker env (worker halts when exceeded)

## 10. Backup storage (S3-compatible)

Required only if running the worker's consent audit export job.

- Backblaze B2 (cheapest) or AWS S3
- Create bucket, generate access key/secret
- Set `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`

## 11. Uptime monitoring

- UptimeRobot or BetterUptime
- HTTP GET check: `https://tensorworks.online/api/health`
- Interval: 5 minutes
- Alert: SMS + email to operator

## Initial content launch checklist

- [ ] All env vars populated in Netlify dashboard
- [ ] Database migrations applied
- [ ] First Mailchimp campaign sent to internal test list
- [ ] RFQ form submission test → HubSpot contact + deal created
- [ ] Newsletter signup test → double opt-in email received and confirmed
- [ ] Health check returns 200
- [ ] Sitemap reachable and submitted to Search Console
