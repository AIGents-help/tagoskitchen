alter table public.availability_blocks
  add column if not exists assigned_business_id uuid references public.businesses(id) on delete set null,
  add column if not exists assigned_sponsored_profile_id uuid references public.sponsored_chef_profiles(id) on delete set null,
  add column if not exists purpose text;

alter table public.availability_blocks drop constraint if exists availability_blocks_single_assignee;
alter table public.availability_blocks add constraint availability_blocks_single_assignee
  check (num_nonnulls(assigned_business_id, assigned_sponsored_profile_id) <= 1);
alter table public.availability_blocks drop constraint if exists availability_blocks_purpose_check;
alter table public.availability_blocks add constraint availability_blocks_purpose_check
  check (purpose is null or purpose in ('chef_production','open_availability','maintenance','cleaning','private_event','owner_use','closed'));

drop policy if exists "providers create own availability" on public.availability_blocks;
create policy "providers create own availability" on public.availability_blocks for insert to authenticated
with check ((select auth.uid())=created_by and exists(select 1 from public.kitchens k where k.id=availability_blocks.kitchen_id and private.is_business_member(k.owner_business_id)) and ((assigned_business_id is null and assigned_sponsored_profile_id is null) or exists(select 1 from public.kitchen_chef_relationships r where r.kitchen_id=availability_blocks.kitchen_id and r.access_status='active' and ((assigned_business_id is not null and r.chef_business_id=assigned_business_id) or (assigned_sponsored_profile_id is not null and r.sponsored_profile_id=assigned_sponsored_profile_id)))));

drop policy if exists "creators update own availability" on public.availability_blocks;
create policy "creators update own availability" on public.availability_blocks for update to authenticated
using ((select auth.uid())=created_by)
with check ((select auth.uid())=created_by and exists(select 1 from public.kitchens k where k.id=availability_blocks.kitchen_id and private.is_business_member(k.owner_business_id)) and ((assigned_business_id is null and assigned_sponsored_profile_id is null) or exists(select 1 from public.kitchen_chef_relationships r where r.kitchen_id=availability_blocks.kitchen_id and r.access_status='active' and ((assigned_business_id is not null and r.chef_business_id=assigned_business_id) or (assigned_sponsored_profile_id is not null and r.sponsored_profile_id=assigned_sponsored_profile_id)))));

create or replace function public.create_booking_request(p_resource_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_notes text default null)
returns jsonb language plpgsql set search_path='' as $$
declare
  v_user_id uuid:=auth.uid(); v_business_id uuid; v_kitchen_id uuid; v_rate integer;
  v_hours numeric; v_subtotal integer; v_fee integer; v_booking_id uuid; v_missing text[];
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_ends_at<=p_starts_at or p_starts_at<now() then raise exception 'Choose a valid future time'; end if;
  if extract(epoch from (p_ends_at-p_starts_at))<7200 then raise exception 'Minimum reservation is 2 hours'; end if;
  select bm.business_id into v_business_id from public.business_members bm join public.businesses b on b.id=bm.business_id where bm.user_id=v_user_id and bm.role='owner' and b.compliance_status='approved' order by bm.business_id limit 1;
  if v_business_id is null then raise exception 'An approved Kitchen Passport is required'; end if;
  select array_agg(req) into v_missing from unnest(array['food_handler_card','liability_insurance','business_license']) req where not exists(select 1 from public.credentials c where c.business_id=v_business_id and c.credential_type=req and c.status='approved' and (c.expires_on is null or c.expires_on>=p_ends_at::date) and (req not in ('food_handler_card','liability_insurance') or c.expires_on is not null));
  if cardinality(v_missing)>0 then raise exception 'Renew required credentials before booking: %',array_to_string(v_missing,', '); end if;
  select er.kitchen_id,er.hourly_rate_cents into v_kitchen_id,v_rate from public.equipment_resources er join public.kitchens k on k.id=er.kitchen_id where er.id=p_resource_id and er.active and k.active;
  if v_kitchen_id is null then raise exception 'This equipment is not available'; end if;
  if not exists(select 1 from public.kitchen_chef_relationships r where r.kitchen_id=v_kitchen_id and r.chef_business_id=v_business_id and r.access_status='active' and (r.starts_on is null or r.starts_on<=p_starts_at::date) and (r.ends_on is null or r.ends_on>=p_ends_at::date)) then raise exception 'You are not approved to book this kitchen'; end if;
  if v_rate<=0 then raise exception 'This equipment is not priced for online booking yet'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_resource_id::text,0));
  if exists(select 1 from public.booking_resources br join public.bookings b on b.id=br.booking_id where br.resource_id=p_resource_id and b.status in ('pending_payment','confirmed') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) or exists(select 1 from public.availability_blocks ab where ab.kitchen_id=v_kitchen_id and (ab.scope='whole_kitchen' or (ab.scope='resource' and ab.equipment_resource_id=p_resource_id)) and ab.kind in ('blocked','resident_priority','maintenance') and tstzrange(ab.starts_at,ab.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) or exists(select 1 from public.chef_assignments ca where ca.kitchen_id=v_kitchen_id and ca.business_id<>v_business_id and (ca.equipment_resource_id is null or ca.equipment_resource_id=p_resource_id) and tstzrange(ca.starts_at,ca.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) then raise exception 'That time or equipment is already reserved'; end if;
  v_hours:=ceil(extract(epoch from (p_ends_at-p_starts_at))/3600); v_subtotal:=round(v_rate*v_hours); v_fee:=round(v_subtotal*0.10);
  insert into public.bookings(kitchen_id,renter_business_id,created_by,starts_at,ends_at,status,subtotal_cents,platform_fee_cents,host_payout_cents,notes,risk_status) values(v_kitchen_id,v_business_id,v_user_id,p_starts_at,p_ends_at,'pending_payment',v_subtotal,v_fee,v_subtotal-v_fee,nullif(trim(p_notes),''),'cleared') returning id into v_booking_id;
  insert into public.booking_resources(booking_id,resource_id,hourly_rate_cents) values(v_booking_id,p_resource_id,v_rate);
  return jsonb_build_object('booking_id',v_booking_id,'status','pending_payment','subtotal_cents',v_subtotal,'platform_fee_cents',v_fee,'host_payout_cents',v_subtotal-v_fee);
end; $$;
