create table if not exists public.availability_blocks (
  id uuid primary key default gen_random_uuid(), kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  equipment_resource_id uuid references public.equipment_resources(id) on delete cascade,
  kind text not null check (kind in ('available','blocked','resident_priority','maintenance')),
  title text not null, starts_at timestamptz not null, ends_at timestamptz not null,
  notes text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  constraint availability_block_time check (ends_at > starts_at)
);
create index if not exists availability_blocks_kitchen_time_idx on public.availability_blocks(kitchen_id,starts_at,ends_at);

create table if not exists public.chef_assignments (
  id uuid primary key default gen_random_uuid(), kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  equipment_resource_id uuid references public.equipment_resources(id) on delete set null,
  assignment_type text not null check (assignment_type in ('resident','flex','event')),
  visibility text not null default 'business_name' check (visibility in ('business_name','blocked_only')),
  starts_at timestamptz not null, ends_at timestamptz not null, notes text,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  constraint chef_assignment_time check (ends_at > starts_at)
);
create index if not exists chef_assignments_kitchen_time_idx on public.chef_assignments(kitchen_id,starts_at,ends_at);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(), kitchen_id uuid references public.kitchens(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null, title text not null, description text,
  location_type text not null check (location_type in ('tagos','food_truck','offsite')),
  public_location text, starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','scheduled','published','cancelled')),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  constraint promotion_time check (ends_at > starts_at)
);
create index if not exists promotions_status_time_idx on public.promotions(status,starts_at);

create table if not exists public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(), kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  equipment_resource_id uuid references public.equipment_resources(id) on delete set null,
  title text not null, description text, priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','scheduled','in_progress','waiting','resolved','closed')),
  assigned_to text, due_at timestamptz, cost_cents integer not null default 0 check (cost_cents >= 0),
  opened_by uuid not null references auth.users(id), resolved_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists maintenance_tickets_kitchen_status_idx on public.maintenance_tickets(kitchen_id,status,priority);

create table if not exists public.booking_transactions (
  id uuid primary key default gen_random_uuid(), booking_id uuid references public.bookings(id) on delete set null,
  kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('rent_charge','deposit','refund','adjustment','cleaning_fee','damage_fee')),
  gross_cents integer not null default 0, platform_fee_cents integer not null default 0, provider_net_cents integer not null default 0,
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded','disputed')),
  payment_provider text not null default 'manual', external_reference text, occurred_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id), notes text, created_at timestamptz not null default now()
);
create index if not exists booking_transactions_kitchen_time_idx on public.booking_transactions(kitchen_id,occurred_at desc);

create table if not exists public.provider_payouts (
  id uuid primary key default gen_random_uuid(), kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  booking_transaction_id uuid references public.booking_transactions(id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0), status text not null default 'pending' check (status in ('pending','scheduled','paid','failed','held')),
  due_at timestamptz, paid_at timestamptz, provider_reference text, issue_notes text,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists provider_payouts_kitchen_status_idx on public.provider_payouts(kitchen_id,status,due_at);

alter table public.availability_blocks enable row level security;
alter table public.chef_assignments enable row level security;
alter table public.promotions enable row level security;
alter table public.maintenance_tickets enable row level security;
alter table public.booking_transactions enable row level security;
alter table public.provider_payouts enable row level security;

grant select,insert,update,delete on public.availability_blocks,public.chef_assignments,public.promotions,public.maintenance_tickets,public.booking_transactions,public.provider_payouts to authenticated;
revoke all on public.availability_blocks,public.chef_assignments,public.maintenance_tickets,public.booking_transactions,public.provider_payouts from anon;
grant select on public.promotions to anon;

create policy "staff manage availability" on public.availability_blocks for all to authenticated using ((select private.is_platform_staff())) with check ((select private.is_platform_staff()));
create policy "staff manage assignments" on public.chef_assignments for all to authenticated using ((select private.is_platform_staff())) with check ((select private.is_platform_staff()));
create policy "staff manage promotions" on public.promotions for all to authenticated using ((select private.is_platform_staff())) with check ((select private.is_platform_staff()));
create policy "public read published promotions" on public.promotions for select to anon using (status='published' and ends_at > now());
create policy "staff manage maintenance" on public.maintenance_tickets for all to authenticated using ((select private.is_platform_staff())) with check ((select private.is_platform_staff()));
create policy "staff manage transactions" on public.booking_transactions for all to authenticated using ((select private.is_platform_staff())) with check ((select private.is_platform_staff()));
create policy "staff manage payouts" on public.provider_payouts for all to authenticated using ((select private.is_platform_staff())) with check ((select private.is_platform_staff()));
