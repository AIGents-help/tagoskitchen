create table public.sponsored_chef_profiles (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  chef_name text not null,
  email text not null,
  phone text,
  business_name text not null,
  business_type text not null default 'Independent chef',
  notes text,
  status text not null default 'invited' check(status in ('invited','claimed','cancelled')),
  claimed_by uuid references public.profiles(id),
  claimed_business_id uuid references public.businesses(id),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique(kitchen_id,email)
);
alter table public.sponsored_chef_profiles enable row level security;
create policy "providers manage sponsored chefs" on public.sponsored_chef_profiles for all to authenticated
using(exists(select 1 from public.kitchens k where k.id=kitchen_id and private.is_business_member(k.owner_business_id)))
with check(created_by=(select auth.uid()) and exists(select 1 from public.kitchens k where k.id=kitchen_id and private.is_business_member(k.owner_business_id)));
create policy "staff manage sponsored chefs" on public.sponsored_chef_profiles for all to authenticated
using((select private.is_platform_staff())) with check((select private.is_platform_staff()));
grant select,insert,update,delete on public.sponsored_chef_profiles to authenticated;

create or replace function public.claim_sponsored_chef_profile()
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid()); v_email text; v_invite public.sponsored_chef_profiles; v_business uuid;
begin
  if v_user is null then return null; end if;
  select lower(email) into v_email from auth.users where id=v_user;
  select * into v_invite from public.sponsored_chef_profiles where lower(email)=v_email and status='invited' order by created_at limit 1 for update;
  if v_invite.id is null then return null; end if;
  insert into public.businesses(name,business_type,compliance_status,schedule_identity_visibility)
    values(v_invite.business_name,v_invite.business_type,'draft','visible') returning id into v_business;
  insert into public.business_members(business_id,user_id,role) values(v_business,v_user,'owner');
  update public.profiles set full_name=coalesce(nullif(full_name,''),v_invite.chef_name),phone=coalesce(phone,v_invite.phone) where id=v_user;
  update public.sponsored_chef_profiles set status='claimed',claimed_by=v_user,claimed_business_id=v_business,claimed_at=now() where id=v_invite.id;
  return v_business;
end; $$;
revoke all on function public.claim_sponsored_chef_profile() from public,anon;
grant execute on function public.claim_sponsored_chef_profile() to authenticated;
