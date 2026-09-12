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

## Current product

The private interactive product is published through ChatGPT Sites while the external application repository and live service integrations are established.

## Security principles

- Credentials are private by default and accessed through signed URLs.
- Renter and owner permissions are enforced in the database, not only in the interface.
- Payments are processed by Stripe; raw card details are never stored by this application.
- Every compliance decision and booking-state change is auditable.
