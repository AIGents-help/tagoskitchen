-- Give platform staff a real operating business behind a kitchen-sponsored
-- chef record without falsely marking the invitation as claimed by the chef.
create or replace function public.admin_prepare_chef_workspace(
  p_record_id uuid,
  p_source text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_business_id uuid;
  v_sponsored public.sponsored_chef_profiles;
  v_slug text;
begin
  if auth.uid() is null or not private.is_platform_staff() then
    raise exception 'Administrator access required';
  end if;

  if p_source = 'business' then
    select id into v_business_id from public.businesses where id = p_record_id;
    if v_business_id is null then raise exception 'Chef business not found'; end if;
    return v_business_id;
  end if;

  if p_source <> 'sponsored' then raise exception 'Invalid chef source'; end if;
  select * into v_sponsored from public.sponsored_chef_profiles where id = p_record_id for update;
  if v_sponsored.id is null then raise exception 'Sponsored chef not found'; end if;

  v_business_id := v_sponsored.claimed_business_id;
  if v_business_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(v_sponsored.business_name), '[^a-z0-9]+', '-', 'g'))
      || '-managed-' || left(replace(v_sponsored.id::text, '-', ''), 8);
    insert into public.businesses(name, slug, business_type, compliance_status, schedule_identity_visibility, created_by)
    values(v_sponsored.business_name, v_slug, v_sponsored.business_type, v_sponsored.compliance_status, 'visible', auth.uid())
    returning id into v_business_id;
    update public.sponsored_chef_profiles set claimed_business_id = v_business_id where id = v_sponsored.id;
    update public.kitchen_chef_relationships set chef_business_id = v_business_id, updated_at = now()
      where sponsored_profile_id = v_sponsored.id;
    update public.availability_blocks set assigned_business_id=v_business_id,assigned_sponsored_profile_id=null
      where assigned_sponsored_profile_id=v_sponsored.id;
  end if;
  return v_business_id;
end;
$$;
revoke all on function public.admin_prepare_chef_workspace(uuid,text) from public,anon;
grant execute on function public.admin_prepare_chef_workspace(uuid,text) to authenticated;

-- The invited chef later claims the already-prepared workspace rather than
-- receiving a duplicate business.
create or replace function public.claim_sponsored_chef_profile()
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid()); v_email text; v_invite public.sponsored_chef_profiles; v_business uuid;
begin
  if v_user is null then return null; end if;
  select lower(email) into v_email from auth.users where id=v_user;
  select * into v_invite from public.sponsored_chef_profiles where lower(email)=v_email and status='invited' order by created_at limit 1 for update;
  if v_invite.id is null then return null; end if;
  v_business := v_invite.claimed_business_id;
  if v_business is null then
    insert into public.businesses(name,business_type,compliance_status,schedule_identity_visibility)
      values(v_invite.business_name,v_invite.business_type,v_invite.compliance_status,'visible') returning id into v_business;
  end if;
  insert into public.business_members(business_id,user_id,role) values(v_business,v_user,'owner') on conflict do nothing;
  update public.profiles set full_name=coalesce(nullif(full_name,''),v_invite.chef_name),phone=coalesce(phone,v_invite.phone) where id=v_user;
  update public.sponsored_chef_profiles set status='claimed',claimed_by=v_user,claimed_business_id=v_business,claimed_at=now() where id=v_invite.id;
  update public.kitchen_chef_relationships set chef_business_id=v_business,updated_at=now() where sponsored_profile_id=v_invite.id;
  update public.availability_blocks set assigned_business_id=v_business,assigned_sponsored_profile_id=null where assigned_sponsored_profile_id=v_invite.id;
  return v_business;
end; $$;
revoke all on function public.claim_sponsored_chef_profile() from public,anon;
grant execute on function public.claim_sponsored_chef_profile() to authenticated;

create or replace function public.admin_create_booking_request(
  p_business_id uuid,
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_kitchen_id uuid; v_rate integer; v_hours numeric; v_subtotal integer;
  v_fee integer; v_booking_id uuid;
begin
  if auth.uid() is null or not private.is_platform_staff() then raise exception 'Administrator access required'; end if;
  if not exists(select 1 from public.businesses where id=p_business_id and compliance_status='approved') then raise exception 'Chef must be approved'; end if;
  if p_ends_at<=p_starts_at or p_starts_at<now() then raise exception 'Choose a valid future time'; end if;
  if extract(epoch from (p_ends_at-p_starts_at))<7200 then raise exception 'Minimum reservation is 2 hours'; end if;
  select er.kitchen_id,er.hourly_rate_cents into v_kitchen_id,v_rate
    from public.equipment_resources er join public.kitchens k on k.id=er.kitchen_id
    where er.id=p_resource_id and er.active and k.active;
  if v_kitchen_id is null then raise exception 'This equipment is not available'; end if;
  if not exists(select 1 from public.kitchen_chef_relationships r where r.kitchen_id=v_kitchen_id and r.chef_business_id=p_business_id and r.access_status='active') then raise exception 'Chef is not approved for this kitchen'; end if;
  if v_rate<=0 then raise exception 'This equipment is not priced for online booking yet'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_resource_id::text,0));
  if exists(select 1 from public.booking_resources br join public.bookings b on b.id=br.booking_id where br.resource_id=p_resource_id and b.status in ('requested','pending_payment','confirmed') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)'))
    or exists(select 1 from public.availability_blocks ab where ab.kitchen_id=v_kitchen_id and (ab.scope='whole_kitchen' or (ab.scope='resource' and ab.equipment_resource_id=p_resource_id)) and ab.kind in ('blocked','resident_priority','maintenance') and ab.assigned_business_id is distinct from p_business_id and tstzrange(ab.starts_at,ab.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)'))
  then raise exception 'That time or equipment is already reserved'; end if;
  v_hours:=ceil(extract(epoch from (p_ends_at-p_starts_at))/3600); v_subtotal:=round(v_rate*v_hours); v_fee:=round(v_subtotal*0.10);
  insert into public.bookings(kitchen_id,renter_business_id,created_by,starts_at,ends_at,status,subtotal_cents,platform_fee_cents,host_payout_cents,notes,risk_status)
    values(v_kitchen_id,p_business_id,auth.uid(),p_starts_at,p_ends_at,'requested',v_subtotal,v_fee,v_subtotal-v_fee,nullif(trim(p_notes),''),'cleared') returning id into v_booking_id;
  insert into public.booking_resources(booking_id,resource_id,hourly_rate_cents) values(v_booking_id,p_resource_id,v_rate);
  return jsonb_build_object('booking_id',v_booking_id,'status','requested','subtotal_cents',v_subtotal);
end; $$;
revoke all on function public.admin_create_booking_request(uuid,uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.admin_create_booking_request(uuid,uuid,timestamptz,timestamptz,text) to authenticated;

-- Keep platform-managed, unclaimed chefs in the directory with their real
-- contact details even after the operating workspace has been prepared.
create or replace function public.admin_list_chefs()
returns table(record_id uuid,source text,business_id uuid,first_name text,last_name text,display_name text,business_name text,business_type text,email text,phone text,status text,kitchen_ids uuid[],kitchen_names text[])
language plpgsql security definer set search_path='' as $$
begin
  if not private.is_platform_staff() then raise exception 'Administrator access required'; end if;
  return query
  with registered as (
    select b.id,'business'::text,b.id,
      nullif(split_part(trim(coalesce(p.full_name,'')),' ',1),''),nullif(regexp_replace(trim(coalesce(p.full_name,'')),'^\S+\s*',''),''),nullif(trim(p.full_name),''),
      b.name,b.business_type,u.email::text,p.phone,b.compliance_status,
      coalesce(array_agg(distinct k.id) filter(where k.id is not null),'{}'::uuid[]),coalesce(array_agg(distinct k.name) filter(where k.name is not null),'{}'::text[])
    from public.businesses b
    left join public.business_members bm on bm.business_id=b.id and bm.role='owner'
    left join public.profiles p on p.id=bm.user_id left join auth.users u on u.id=bm.user_id
    left join public.kitchen_chef_relationships r on r.chef_business_id=b.id left join public.kitchens k on k.id=r.kitchen_id
    where lower(coalesce(b.business_type,'')) in ('independent chef','caterer','baker','meal-prep business','food truck operator','packaged-food maker')
      and not exists(select 1 from public.sponsored_chef_profiles s where s.claimed_business_id=b.id and s.status<>'claimed')
    group by b.id,p.full_name,p.phone,u.email
  ), sponsored as (
    select s.id,'sponsored'::text,s.claimed_business_id,
      nullif(split_part(trim(coalesce(s.chef_name,'')),' ',1),''),nullif(regexp_replace(trim(coalesce(s.chef_name,'')),'^\S+\s*',''),''),s.chef_name,
      s.business_name,s.business_type,s.email,s.phone,s.compliance_status,array[s.kitchen_id]::uuid[],array[k.name]::text[]
    from public.sponsored_chef_profiles s join public.kitchens k on k.id=s.kitchen_id where s.status<>'claimed'
  ) select * from registered union all select * from sponsored;
end; $$;
revoke all on function public.admin_list_chefs() from public,anon;
grant execute on function public.admin_list_chefs() to authenticated;
