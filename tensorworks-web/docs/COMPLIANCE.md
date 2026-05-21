# Compliance Posture

Legal framework the site operates under, and the procedures we follow to stay inside it.

## Spam Act 2003 (Cth)

Every commercial electronic message we send must:

1. **Have consent** — express, inferred, or deemed
2. **Identify the sender** — TensorWorks Pty Ltd, ABN 84 544 119 830, Bendigo VIC
3. **Have a working unsubscribe** — one-click, no login required, processed within 5 business days

### Consent types

| Type | When it applies | Evidence stored |
|------|----------------|----------------|
| `express` | User ticked the consent box on the newsletter signup form | `consentTimestamp`, `consentIp`, form variant in `consentSource` |
| `inferred_rfq` | User submitted an RFQ and opted in during the form | RFQ submission record + signup record |
| `inferred_business` | We added a contact based on a publicly-published role/email (e.g. CTO at university) | `consentNote` records the source URL and role-relevance reasoning |
| `deemed_published` | Email address was published with no statement against unsolicited contact | Rarely used; documented case-by-case |

### Unsubscribe handling

- Every marketing email contains a token-based unsubscribe URL: `/api/newsletter/unsubscribe?token=...`
- Tokens are per-recipient and 365-day expiry
- One-click GET unsubscribes immediately (no POST/login)
- `NewsletterSubscriber.status` transitions to `unsubscribed`; Mailchimp is updated via API
- Complaints (spam reports) trigger `status=complained` — these contacts are permanently suppressed

### Suppression list

The combined "do not email" set is:
- Anyone with `status` in `{unsubscribed, bounced, complained}`
- Manually-added addresses in the suppression table (future feature; currently use Mailchimp's built-in suppression)

## Privacy Act 1988 (Cth) and APPs

We collect:
- **Contact details** (name, email, phone, company) — from RFQ form, newsletter signup
- **Business context** (use case, budget bracket) — from RFQ form
- **IP address and user agent** — for rate limiting and consent records (Spam Act audit trail)
- **GA4 analytics** — anonymised page views and event data, only after explicit cookie consent

We do not:
- Sell personal information to third parties
- Use personal data for purposes beyond what's stated on the privacy page
- Retain RFQ submissions after the engagement concludes (default retention: 7 years for tax records)

### Breach notification

The Notifiable Data Breaches scheme applies if a breach is likely to result in serious harm. If a breach is detected:
1. Contain — disable affected credentials, rotate keys
2. Assess — what was accessed, who is affected
3. Notify the OAIC and affected individuals within 30 days if the test is met
4. Document the assessment in the incident log

## Copyright Act 1968 (Cth) and editorial content

The AI editorial engine processes third-party news sources:
- We do not republish source material — only summarise and link
- Citations on every generated post include source URL and accessed date
- A copyright check (n-gram Jaccard overlap) ensures < 5% verbatim overlap with any single source
- If a publisher complains, the takedown procedure is:
  1. Remove the post within 24 hours
  2. Add the source URL to a "do not summarise" list
  3. Respond to the complainant in writing acknowledging removal

## Australian Consumer Law (ACL)

For the RFQ-to-quote-to-invoice flow:
- All quotes are inclusive of GST and explicitly state GST
- Statements of Work are the binding document, not the RFQ
- Goods and services come with consumer guarantees that cannot be excluded

## Monthly compliance review

Performed on the first business day of each month:

- [ ] Review unsubscribe rate (target < 0.5% per campaign)
- [ ] Review bounce rate (halt sending if > 5% on any segment)
- [ ] Review complaint rate (any complaints → investigate sender content)
- [ ] Confirm consent audit export uploaded for previous month
- [ ] Verify suppression list synced between local DB and Mailchimp
- [ ] Spot-check 5 new subscribers — is consent basis documented?

## Annual compliance audit

Performed each financial year end (30 June):

- Full export of consent records
- Review of every email template for current ABN/address
- Test unsubscribe links on every active campaign template
- Review of privacy policy for currency
- Penetration test scope review

## Document retention

| Record | Retention |
|--------|-----------|
| Consent records (`NewsletterSubscriber`) | 7 years from unsubscribe date |
| RFQ submissions | 7 years (tax) |
| Email campaign records | 7 years |
| Audit logs (system events) | 7 years |
| GA4 analytics | 14 months (GA default) |
