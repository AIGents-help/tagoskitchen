create table public.kitchen_chef_relationships (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  sponsored_profile_id uuid references public.sponsored_chef_profiles(id) on delete set null,
  chef_business_id uuid references public.businesses(id) on delete set null,
  relationship_tier text not null default 'hourly' check(relationship_tier in ('resident','recurring','hourly')),
  access_status text not null default 'pending' check(access_status in ('pending','active','paused','ended')),
  resident_priority boolean not null default false,
  dedicated_sqft integer check(dedicated_sqft is null or dedicated_sqft >= 0),
  cold_storage text,
  freezer_storage text,
  dry_storage text,
  table_space text,
  shared_equipment_notes text,
  starts_on date,
  ends_on date,
  internal_notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relationship_has_chef check(sponsored_profile_id is not null or chef_business_id is not null),
  unique(kitchen_id,sponsored_profile_id)
);
alter table public.kitchen_chef_relationships enable row level security;
create policy "providers manage kitchen chef relationships" on public.kitchen_chef_relationships for all to authenticated
using(exists(select 1 from public.kitchens k where k.id=kitchen_id and private.is_business_member(k.owner_business_id)))
with check(created_by=(select auth.uid()) and exists(select 1 from public.kitchens k where k.id=kitchen_id and private.is_business_member(k.owner_business_id)));
create policy "chefs read own kitchen relationships" on public.kitchen_chef_relationships for select to authenticated
using(chef_business_id is not null and (select private.is_business_member(chef_business_id)));
create policy "staff manage kitchen chef relationships" on public.kitchen_chef_relationships for all to authenticated
using((select private.is_platform_staff())) with check((select private.is_platform_staff()));
grant select,insert,update,delete on public.kitchen_chef_relationships to authenticated;
create index kitchen_chef_relationships_kitchen_idx on public.kitchen_chef_relationships(kitchen_id,access_status,relationship_tier);

create or replace function private.sync_claimed_sponsored_chef() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='claimed' and new.claimed_business_id is not null then
    update public.kitchen_chef_relationships set chef_business_id=new.claimed_business_id,updated_at=now() where sponsored_profile_id=new.id;
  end if;
  return new;
end; $$;
create trigger sync_claimed_sponsored_chef after update of status,claimed_business_id on public.sponsored_chef_profiles for each row execute function private.sync_claimed_sponsored_chef();
