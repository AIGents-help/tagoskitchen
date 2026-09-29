create table public.resident_documents (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  sponsored_profile_id uuid not null references public.sponsored_chef_profiles(id) on delete cascade,
  relationship_id uuid references public.kitchen_chef_relationships(id) on delete set null,
  document_type text not null default 'lease',
  document_path text not null,
  original_name text not null,
  mime_type text not null default 'application/pdf',
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.resident_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default ('TAG-RENT-' || to_char(now(),'YYYYMM') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  sponsored_profile_id uuid not null references public.sponsored_chef_profiles(id) on delete restrict,
  relationship_id uuid references public.kitchen_chef_relationships(id) on delete set null,
  billing_period date not null,
  amount_due_cents integer not null check(amount_due_cents > 0),
  amount_paid_cents integer not null default 0 check(amount_paid_cents >= 0),
  payment_method text,
  paid_at timestamptz,
  status text not null default 'draft' check(status in ('draft','open','paid','void')),
  recipient_email text not null,
  notes text,
  issued_by uuid not null references public.profiles(id),
  issued_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sponsored_profile_id,billing_period)
);

alter table public.resident_documents enable row level security;
alter table public.resident_invoices enable row level security;

create policy "providers manage resident documents" on public.resident_documents for all to authenticated
using (exists(select 1 from public.kitchens k where k.id=kitchen_id and private.is_business_member(k.owner_business_id)))
with check (uploaded_by=(select auth.uid()) and exists(select 1 from public.kitchens k where k.id=kitchen_id and private.is_business_member(k.owner_business_id)));
create policy "staff manage resident documents" on public.resident_documents for all to authenticated
using ((select private.is_platform_staff())) with check ((select private.is_platform_staff()));

create policy "providers manage resident invoices" on public.resident_invoices for all to authenticated
using (exists(select 1 from public.kitchens k where k.id=kitchen_id and private.is_business_member(k.owner_business_id)))
with check (issued_by=(select auth.uid()) and exists(select 1 from public.kitchens k where k.id=kitchen_id and private.is_business_member(k.owner_business_id)));
create policy "staff manage resident invoices" on public.resident_invoices for all to authenticated
using ((select private.is_platform_staff())) with check ((select private.is_platform_staff()));

grant select,insert,update,delete on public.resident_documents to authenticated;
grant select,insert,update,delete on public.resident_invoices to authenticated;

create index resident_documents_profile_idx on public.resident_documents(sponsored_profile_id,created_at desc);
create index resident_invoices_kitchen_period_idx on public.resident_invoices(kitchen_id,billing_period desc);
