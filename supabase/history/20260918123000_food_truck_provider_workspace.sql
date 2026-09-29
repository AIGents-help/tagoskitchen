create table if not exists public.food_trucks (
  id uuid primary key default gen_random_uuid(),
  owner_business_id uuid not null references public.businesses(id) on delete cascade,
  base_kitchen_id uuid references public.kitchens(id) on delete set null,
  source_equipment_id uuid references public.equipment_resources(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  year integer,
  make text,
  model text,
  plate_number text,
  gvwr_lbs integer,
  service_area text,
  current_location text,
  hourly_rate_cents integer not null default 0 check (hourly_rate_cents >= 0),
  daily_rate_cents integer not null default 0 check (daily_rate_cents >= 0),
  delivery_base_cents integer not null default 0 check (delivery_base_cents >= 0),
  mileage_rate_cents integer not null default 0 check (mileage_rate_cents >= 0),
  security_deposit_cents integer not null default 0 check (security_deposit_cents >= 0),
  service_radius_miles integer not null default 25 check (service_radius_miles > 0),
  transportation_policy text not null default 'owner_supplied_driver'
    check (transportation_policy = 'owner_supplied_driver'),
  renter_driving_allowed boolean not null default false check (renter_driving_allowed = false),
  handoff_modes text[] not null default array['commissary_loadout','direct_location']::text[],
  equipment text[] not null default '{}',
  amenities text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','suspended')),
  active boolean not null default false,
  accepting_requests boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_truck_drivers (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.food_trucks(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  license_class text not null default 'Standard',
  license_expires_on date,
  insurance_approved boolean not null default false,
  mvr_reviewed_at timestamptz,
  truck_orientation_completed_at timestamptz,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.food_truck_documents (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.food_trucks(id) on delete cascade,
  driver_id uuid references public.food_truck_drivers(id) on delete cascade,
  document_type text not null,
  document_path text,
  status text not null default 'missing' check (status in ('missing','submitted','approved','rejected','expired')),
  expires_on date,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_truck_menu_items (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.food_trucks(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  service_capacity_per_hour integer,
  allergens text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.food_truck_requests (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.food_trucks(id) on delete restrict,
  renter_business_id uuid not null references public.businesses(id) on delete restrict,
  requested_driver_id uuid references public.food_truck_drivers(id) on delete set null,
  event_name text not null,
  event_location text not null,
  service_starts_at timestamptz not null,
  service_ends_at timestamptz not null,
  prep_starts_at timestamptz,
  prep_ends_at timestamptz,
  reset_ends_at timestamptz,
  handoff_mode text not null check (handoff_mode in ('commissary_loadout','direct_location')),
  driver_service text not null default 'delivery_pickup' check (driver_service in ('delivery_pickup','driver_on_call','full_service')),
  menu_summary text,
  expected_guests integer,
  location_permission_confirmed boolean not null default false,
  permits_confirmed boolean not null default false,
  status text not null default 'requested' check (status in ('requested','needs_information','approved','declined','cancelled','completed')),
  subtotal_cents integer not null default 0,
  security_deposit_cents integer not null default 0,
  provider_note text,
  created_at timestamptz not null default now(),
  check (service_ends_at > service_starts_at)
);

create table if not exists public.food_truck_checklists (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.food_truck_requests(id) on delete cascade,
  phase text not null check (phase in ('pre_departure','handoff','return_reset')),
  completed_by uuid references public.profiles(id),
  checklist jsonb not null default '{}',
  condition_notes text,
  mileage integer,
  fuel_level text,
  refrigeration_temp_f numeric,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(request_id, phase)
);

create index if not exists food_trucks_owner_idx on public.food_trucks(owner_business_id);
create index if not exists food_trucks_base_kitchen_idx on public.food_trucks(base_kitchen_id);
create index if not exists food_truck_drivers_truck_idx on public.food_truck_drivers(truck_id);
create index if not exists food_truck_documents_truck_idx on public.food_truck_documents(truck_id);
create index if not exists food_truck_menu_items_truck_idx on public.food_truck_menu_items(truck_id);
create index if not exists food_truck_requests_truck_time_idx on public.food_truck_requests(truck_id,service_starts_at);
create index if not exists food_truck_requests_renter_idx on public.food_truck_requests(renter_business_id);

alter table public.food_trucks enable row level security;
alter table public.food_truck_drivers enable row level security;
alter table public.food_truck_documents enable row level security;
alter table public.food_truck_menu_items enable row level security;
alter table public.food_truck_requests enable row level security;
alter table public.food_truck_checklists enable row level security;

create or replace function private.protect_food_truck_approval()
returns trigger language plpgsql set search_path='' as $$
begin
  if (select auth.uid()) is not null and not private.is_platform_staff() then
    if new.status in ('approved','rejected','suspended') and (tg_op='INSERT' or new.status is distinct from old.status) then
      raise exception 'Only TaGo''s administrators may approve, reject or suspend a food truck';
    end if;
    if new.active and (tg_op='INSERT' or new.active is distinct from old.active) then
      raise exception 'Only TaGo''s administrators may publish a food truck';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists protect_food_truck_approval on public.food_trucks;
create trigger protect_food_truck_approval before insert or update on public.food_trucks for each row execute function private.protect_food_truck_approval();

create or replace function private.protect_food_truck_document_review()
returns trigger language plpgsql set search_path='' as $$
begin
  if (select auth.uid()) is not null and not private.is_platform_staff()
     and new.status in ('approved','rejected','expired')
     and (tg_op='INSERT' or new.status is distinct from old.status) then
    raise exception 'Only TaGo''s administrators may review food truck documents';
  end if;
  return new;
end; $$;
drop trigger if exists protect_food_truck_document_review on public.food_truck_documents;
create trigger protect_food_truck_document_review before insert or update on public.food_truck_documents for each row execute function private.protect_food_truck_document_review();

create policy "public reads approved food trucks" on public.food_trucks for select to anon
using (status='approved' and active);
create policy "authenticated reads approved or owned food trucks" on public.food_trucks for select to authenticated
using ((status='approved' and active) or (select private.is_business_member(owner_business_id)) or (select private.is_platform_staff()));
create policy "providers create food trucks" on public.food_trucks for insert to authenticated
with check ((select private.is_business_member(owner_business_id)) and created_by=(select auth.uid()) and renter_driving_allowed=false);
create policy "providers update food trucks" on public.food_trucks for update to authenticated
using ((select private.is_business_member(owner_business_id)) or (select private.is_platform_staff()))
with check (((select private.is_business_member(owner_business_id)) or (select private.is_platform_staff())) and renter_driving_allowed=false);
create policy "providers delete draft food trucks" on public.food_trucks for delete to authenticated
using (((select private.is_business_member(owner_business_id)) and status='draft') or (select private.is_platform_staff()));

create policy "providers manage food truck drivers" on public.food_truck_drivers for all to authenticated
using (exists(select 1 from public.food_trucks t where t.id=truck_id and ((select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))))
with check (exists(select 1 from public.food_trucks t where t.id=truck_id and ((select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))));
create policy "providers manage food truck documents" on public.food_truck_documents for all to authenticated
using (exists(select 1 from public.food_trucks t where t.id=truck_id and ((select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))))
with check (exists(select 1 from public.food_trucks t where t.id=truck_id and ((select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))));
create policy "public reads active truck menus" on public.food_truck_menu_items for select to anon
using (active and exists(select 1 from public.food_trucks t where t.id=truck_id and t.status='approved' and t.active));
create policy "authenticated reads active or owned truck menus" on public.food_truck_menu_items for select to authenticated
using ((active and exists(select 1 from public.food_trucks t where t.id=truck_id and t.status='approved' and t.active)) or exists(select 1 from public.food_trucks t where t.id=truck_id and ((select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))));
create policy "providers manage truck menus" on public.food_truck_menu_items for all to authenticated
using (exists(select 1 from public.food_trucks t where t.id=truck_id and ((select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))))
with check (exists(select 1 from public.food_trucks t where t.id=truck_id and ((select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))));

create policy "parties read truck requests" on public.food_truck_requests for select to authenticated
using ((select private.is_business_member(renter_business_id)) or exists(select 1 from public.food_trucks t where t.id=truck_id and (select private.is_business_member(t.owner_business_id))) or (select private.is_platform_staff()));
create policy "chefs create truck requests" on public.food_truck_requests for insert to authenticated
with check ((select private.is_business_member(renter_business_id)));
create policy "parties update truck requests" on public.food_truck_requests for update to authenticated
using ((select private.is_business_member(renter_business_id)) or exists(select 1 from public.food_trucks t where t.id=truck_id and (select private.is_business_member(t.owner_business_id))) or (select private.is_platform_staff()))
with check ((select private.is_business_member(renter_business_id)) or exists(select 1 from public.food_trucks t where t.id=truck_id and (select private.is_business_member(t.owner_business_id))) or (select private.is_platform_staff()));
create policy "parties manage truck checklists" on public.food_truck_checklists for all to authenticated
using (exists(select 1 from public.food_truck_requests r join public.food_trucks t on t.id=r.truck_id where r.id=request_id and ((select private.is_business_member(r.renter_business_id)) or (select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))))
with check (exists(select 1 from public.food_truck_requests r join public.food_trucks t on t.id=r.truck_id where r.id=request_id and ((select private.is_business_member(r.renter_business_id)) or (select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))));

grant select,insert,update,delete on public.food_trucks,public.food_truck_drivers,public.food_truck_documents,public.food_truck_menu_items,public.food_truck_requests,public.food_truck_checklists to authenticated;
grant select on public.food_trucks,public.food_truck_menu_items to anon;

insert into public.food_trucks(owner_business_id,base_kitchen_id,source_equipment_id,name,slug,description,hourly_rate_cents,status,active,accepting_requests,created_by,equipment)
select k.owner_business_id,k.id,e.id,'TaGo''s Food Truck','tagos-food-truck',
  'Licensed mobile kitchen based at TaGo''s Linwood. Transportation is supplied and controlled by the truck owner.',
  e.hourly_rate_cents,'draft',false,false,b.created_by,
  array['Mobile kitchen','Owner-supplied driver']::text[]
from public.equipment_resources e
join public.kitchens k on k.id=e.kitchen_id
join public.businesses b on b.id=k.owner_business_id
where lower(e.name)='licensed food truck' and lower(e.category)='mobile_kitchen'
on conflict (slug) do nothing;
