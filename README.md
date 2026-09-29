# TaGo's Kitchen Market

Commercial-kitchen marketplace and operating system for independent food businesses.

## Product scope

- User and food-business profiles
- Reusable credential vault / Kitchen Passport
- Kitchen, equipment-group, and station scheduling
- Conflict-free hourly reservations
- Marketplace booking payments with a 10% platform commission
- Optional connected accounts for renters to accept client deposits, invoices, preorders, and subscriptions
- Kitchen-owner administration, compliance review, utilization, payouts, and reporting

## Planned services

- **Supabase project:** `aiiideoxiuzoizujkiui`
  - Authentication
  - PostgreSQL application database
  - Private credential-document storage
  - Row-level security and audit history
- **Stripe Connect:** marketplace payments, application fees, renter accounts, refunds, and payouts
- **Resend:** verification, booking, reminder, expiration, and payment emails
- **Notion:** internal operating procedures and knowledge only; not transactional data

## Application source and deployment

This repository includes the Next.js application used by the current TaGo's site. The
`codex/site-source-to-vercel` branch prepares it for a Git-backed Vercel build.
Use Node.js 22 or later and `corepack pnpm install --frozen-lockfile`, then
`corepack pnpm build`. Connect the existing Vercel project to this repository and
verify a preview deployment before moving the production domain. The current
production domain still serves the prior ChatGPT Sites deployment until cutover.

The server routes require these Vercel production and preview environment
variables as applicable: `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `TAGOS_INVOICE_FROM`, and
`NEXT_PUBLIC_APP_URL` (the actual public origin for each environment). Do not
commit secret values. Stripe Connect authorization alone does not configure
the app's server-side keys or webhook destination.

The files in `supabase/history/` are snapshots of changes already applied to
the live database. They are kept out of the active `migrations/` folder to
avoid replaying them alongside the older numbered schema files. Reconcile
migration history before any automated database push; the existing live
project is `aiiideoxiuzoizujkiui`.

## Security principles

- Credentials are private by default and accessed through signed URLs.
- Renter and owner permissions are enforced in the database, not only in the interface.
- Payments are processed by Stripe; raw card details are never stored by this application.
- Every compliance decision and booking-state change is auditable.
