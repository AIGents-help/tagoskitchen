create table public.business_public_profiles (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  business_name text not null,
  public_description text,
  is_published boolean not null default false,
  service_area text,
  food_categories text[] not null default '{}',
  menu_summary text,
  contact_email text,
  contact_phone text,
  catering_available boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint public_profile_contact_required check (
    not is_published or contact_email is not null or contact_phone is not null
  )
);

create table public.catering_opportunities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  event_date date not null,
  approximate_time text,
  general_location text not null,
  guest_count integer check (guest_count is null or guest_count > 0),
  budget_range text,
  cuisine_preferences text,
  service_requirements text,
  additional_details text,
  status text not null default 'open' check (status in ('draft','open','matched','closed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catering_proposals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.catering_opportunities(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  menu_details text,
  quote_cents integer check (quote_cents is null or quote_cents >= 0),
  status text not null default 'submitted' check (status in ('draft','submitted','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, business_id)
);

alter table public.business_public_profiles enable row level security;
alter table public.catering_opportunities enable row level security;
alter table public.catering_proposals enable row level security;

create function private.is_approved_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = target_business_id and b.compliance_status = 'approved'
  );
$$;

revoke all on function private.is_approved_business(uuid) from public;
grant execute on function private.is_approved_business(uuid) to anon, authenticated;

create policy "public reads published business profiles"
on public.business_public_profiles for select to anon, authenticated
using (is_published and (select private.is_approved_business(business_id)));

create policy "members manage own public profile"
on public.business_public_profiles for all to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "staff manage public profiles"
on public.business_public_profiles for all to authenticated
using ((select private.is_platform_staff()))
with check ((select private.is_platform_staff()));

create policy "customers manage own opportunities"
on public.catering_opportunities for all to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));

create policy "approved businesses read open opportunities"
on public.catering_opportunities for select to authenticated
using (status = 'open' and exists (
  select 1 from public.businesses b
  join public.business_members m on m.business_id = b.id
  where m.user_id = (select auth.uid()) and b.compliance_status = 'approved'
));

create policy "staff manage opportunities"
on public.catering_opportunities for all to authenticated
using ((select private.is_platform_staff()))
with check ((select private.is_platform_staff()));

create policy "businesses create own proposals"
on public.catering_proposals for insert to authenticated
with check (
  submitted_by = (select auth.uid())
  and (select private.is_business_member(business_id))
  and exists (select 1 from public.businesses b where b.id = business_id and b.compliance_status = 'approved')
);

create policy "participants read proposals"
on public.catering_proposals for select to authenticated
using (
  (select private.is_business_member(business_id))
  or exists (
    select 1 from public.catering_opportunities o
    where o.id = opportunity_id and o.customer_id = (select auth.uid())
  )
  or (select private.is_platform_staff())
);

create policy "businesses update own proposals"
on public.catering_proposals for update to authenticated
using ((select private.is_business_member(business_id)))
with check ((select private.is_business_member(business_id)));

create policy "staff manage proposals"
on public.catering_proposals for all to authenticated
using ((select private.is_platform_staff()))
with check ((select private.is_platform_staff()));

grant select on public.business_public_profiles to anon, authenticated;
grant insert, update, delete on public.business_public_profiles to authenticated;
grant select, insert, update, delete on public.catering_opportunities to authenticated;
grant select, insert, update, delete on public.catering_proposals to authenticated;

create index business_public_profiles_published_idx on public.business_public_profiles(is_published) where is_published;
create index catering_opportunities_status_date_idx on public.catering_opportunities(status, event_date);
create index catering_opportunities_customer_idx on public.catering_opportunities(customer_id);
create index catering_proposals_opportunity_idx on public.catering_proposals(opportunity_id);
create index catering_proposals_business_idx on public.catering_proposals(business_id);
