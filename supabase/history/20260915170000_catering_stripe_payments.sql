create table public.catering_payments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.catering_opportunities(id) on delete cascade,
  proposal_id uuid not null unique references public.catering_proposals(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0 and platform_fee_cents <= amount_cents),
  provider_net_cents integer not null check (provider_net_cents >= 0),
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catering_payments enable row level security;

create policy "customers read own catering payments"
on public.catering_payments for select to authenticated
using (customer_id = (select auth.uid()));

create policy "chefs read own catering payments"
on public.catering_payments for select to authenticated
using ((select private.is_business_member(business_id)));

create policy "staff manage catering payments"
on public.catering_payments for all to authenticated
using ((select private.is_platform_staff()))
with check ((select private.is_platform_staff()));

grant select on public.catering_payments to authenticated;
grant select, insert, update, delete on public.catering_payments to service_role;
revoke all on public.catering_payments from anon;

create index catering_payments_business_idx on public.catering_payments(business_id, created_at desc);
create index catering_payments_customer_idx on public.catering_payments(customer_id, created_at desc);
