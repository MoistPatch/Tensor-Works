# Compliance notes

## Privacy Act 1988 (Australia)

The site collects personal information via the RFQ form. Data handling:

- **Collection**: Name, company, ABN, email, phone, role, use case description, IP address, user agent
- **Purpose**: To evaluate the enquiry and respond with a proposal
- **Retention**: RFQ records retained for 7 years (Australian business records requirement)
- **Third parties**: HubSpot (CRM), Resend (transactional email). No advertising or data brokers.
- **Deletion requests**: Handle via the admin panel or direct database query. No automated deletion workflow yet.

Privacy policy is at `/privacy`. Update the "Last updated" date whenever the policy changes.

## Cloudflare Turnstile

All RFQ submissions pass through Cloudflare Turnstile for spam prevention. The token is verified server-side in `app/api/rfq/route.ts` before the submission is saved.

For testing, use these test keys (always pass / always fail):
- Always pass: `1x00000000000000000000AA` (site) / `1x0000000000000000000000000000000AA` (secret)
- Always fail: `2x00000000000000000000AB` (site) / `2x0000000000000000000000000000000AB` (secret)

## Australian Business Number

ABN: **84 544 119 830**

Displayed in:
- `components/layout/Footer.tsx`
- `app/(marketing)/terms/page.tsx`
- `emails/transactional/RFQNotification.tsx`
- `emails/transactional/RFQAcknowledgement.tsx`

## ITAR / Defence export controls

The site does not display or export controlled technical data. Hardware specifications shown are commercially available product datasheets. Customers with ITAR requirements are directed to contact TensorWorks directly — the RFQ form includes a "ITAR compliance required" procurement constraint option.

## Sovereign procurement

The `sovereign-procurement` service entry and the `research-hpc` / `defence` solution pages describe TensorWorks' capability in Australian government and defence procurement. No classified information is published on the site.

## Cookie consent

The site sets no tracking cookies by default. Google Analytics (`NEXT_PUBLIC_GA_ID`) is optional and off unless the env variable is set. If GA is enabled in production, a cookie consent banner is required under Australian Privacy Principles. This is not yet implemented — add before enabling GA.

## Accessibility

Target: WCAG 2.1 AA. Current state: keyboard navigation works, semantic HTML used throughout, colour contrast meets AA on primary/background combinations. Screen reader testing not yet completed.
