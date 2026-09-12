-- TaGo's Kitchen Market: initial marketplace schema
create extension if not exists pgcrypto;

create type public.member_role as enum ('owner','manager','staff');
create type public.credential_status as enum ('pending','approved','rejected','expired');
create type public.booking_status as enum ('draft','pending_documents','pending_payment','confirmed','completed','cancelled','refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_type text,
  description text,
  stripe_account_id text unique,
  payouts_enabled boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role public.member_role not null default 'staff',
  primary key (business_id,user_id)
);

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  credential_type text not null,
  document_path text not null,
  issuing_authority text,
  credential_number text,
  issued_on date,
  expires_on date,
  status public.credential_status not null default 'pending',
  reviewer_id uuid references public.profiles(id),
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.kitchens (
  id uuid primary key default gen_random_uuid(),
  owner_business_id uuid not null references public.businesses(id),
  name text not null,
  slug text not null unique,
  address_line1 text not null,
  city text not null,
  region text not null,
  postal_code text not null,
  timezone text not null default 'America/New_York',
  description text,
  license_status text not null default 'pending',
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.equipment_groups (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  name text not null,
  description text,
  hourly_rate_cents integer not null check (hourly_rate_cents >= 0),
  capacity integer not null default 1 check (capacity > 0),
  active boolean not null default true
);

create table public.equipment_resources (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  name text not null,
  category text not null,
  hourly_rate_cents integer not null check (hourly_rate_cents >= 0),
  capacity integer not null default 1 check (capacity > 0),
  active boolean not null default true
);

create table public.equipment_group_members (
  group_id uuid references public.equipment_groups(id) on delete cascade,
  resource_id uuid references public.equipment_resources(id) on delete cascade,
  primary key (group_id,resource_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id),
  renter_business_id uuid not null references public.businesses(id),
  created_by uuid not null references public.profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'draft',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  host_payout_cents integer not null check (host_payout_cents >= 0),
  stripe_payment_intent_id text unique,
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (platform_fee_cents + host_payout_cents = subtotal_cents)
);

create table public.booking_resources (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  resource_id uuid references public.equipment_resources(id),
  group_id uuid references public.equipment_groups(id),
  hourly_rate_cents integer not null check (hourly_rate_cents >= 0),
  check ((resource_id is not null) <> (group_id is not null))
);
create unique index booking_resource_unique on public.booking_resources(booking_id,resource_id) where resource_id is not null;
create unique index booking_group_unique on public.booking_resources(booking_id,group_id) where group_id is not null;

create table public.client_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  customer_name text,
  customer_email text,
  purpose text not null,
  amount_cents integer not null check (amount_cents > 0),
  platform_fee_cents integer not null default 0,
  stripe_payment_link_id text,
  stripe_payment_intent_id text unique,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index credentials_business_status_idx on public.credentials(business_id,status);
create index bookings_kitchen_time_idx on public.bookings(kitchen_id,starts_at,ends_at);
create index bookings_renter_idx on public.bookings(renter_business_id,starts_at desc);
create index client_payments_business_idx on public.client_payments(business_id,created_at desc);

create or replace function public.is_business_member(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.business_members where business_id=target and user_id=auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.credentials enable row level security;
alter table public.kitchens enable row level security;
alter table public.equipment_groups enable row level security;
alter table public.equipment_resources enable row level security;
alter table public.equipment_group_members enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_resources enable row level security;
alter table public.client_payments enable row level security;
alter table public.audit_events enable row level security;

create policy "users read own profile" on public.profiles for select using (id=auth.uid());
create policy "users update own profile" on public.profiles for update using (id=auth.uid());
create policy "members read businesses" on public.businesses for select using (public.is_business_member(id));
create policy "members read memberships" on public.business_members for select using (user_id=auth.uid() or public.is_business_member(business_id));
create policy "members read credentials" on public.credentials for select using (public.is_business_member(business_id));
create policy "members create credentials" on public.credentials for insert with check (public.is_business_member(business_id));
create policy "members update pending credentials" on public.credentials for update using (public.is_business_member(business_id) and status in ('pending','rejected'));
create policy "public reads active kitchens" on public.kitchens for select using (active=true or public.is_business_member(owner_business_id));
create policy "public reads active groups" on public.equipment_groups for select using (active=true);
create policy "public reads active equipment" on public.equipment_resources for select using (active=true);
create policy "public reads group members" on public.equipment_group_members for select using (true);
create policy "participants read bookings" on public.bookings for select using (public.is_business_member(renter_business_id) or exists(select 1 from public.kitchens k where k.id=kitchen_id and public.is_business_member(k.owner_business_id)));
create policy "renters create bookings" on public.bookings for insert with check (created_by=auth.uid() and public.is_business_member(renter_business_id));
create policy "participants read booking resources" on public.booking_resources for select using (exists(select 1 from public.bookings b where b.id=booking_id and (public.is_business_member(b.renter_business_id) or exists(select 1 from public.kitchens k where k.id=b.kitchen_id and public.is_business_member(k.owner_business_id)))));
create policy "members read client payments" on public.client_payments for select using (public.is_business_member(business_id));
create policy "members create client payments" on public.client_payments for insert with check (public.is_business_member(business_id));

-- Private credential files belong in a non-public Storage bucket named business-credentials.
-- Service-role-only admin review, Stripe webhooks, overlap prevention, and audit writes
-- are implemented in trusted server functions, never in the browser.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('business-credentials','business-credentials',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "credential owners upload files" on storage.objects for insert to authenticated
with check (bucket_id='business-credentials' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "credential owners read files" on storage.objects for select to authenticated
using (bucket_id='business-credentials' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "credential owners delete files" on storage.objects for delete to authenticated
using (bucket_id='business-credentials' and (storage.foldername(name))[1]=auth.uid()::text);
