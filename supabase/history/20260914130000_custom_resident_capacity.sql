alter table public.availability_blocks
  add column if not exists scope text,
  add column if not exists custom_allocation jsonb;

update public.availability_blocks
set scope = case when equipment_resource_id is null then 'whole_kitchen' else 'resource' end
where scope is null;

alter table public.availability_blocks
  alter column scope set default 'whole_kitchen',
  alter column scope set not null,
  add constraint availability_blocks_scope_check
    check (scope in ('whole_kitchen','resource','custom')),
  add constraint availability_blocks_scope_resource_check
    check (
      (scope='resource' and equipment_resource_id is not null and custom_allocation is null)
      or (scope='whole_kitchen' and equipment_resource_id is null and custom_allocation is null)
      or (scope='custom' and equipment_resource_id is null and jsonb_typeof(custom_allocation)='object')
    );

comment on column public.availability_blocks.scope is
  'whole_kitchen blocks all equipment, resource blocks one item, custom reserves a described footprint without blocking shared cooking equipment.';

create or replace function public.create_booking_request(
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
  v_user_id uuid := auth.uid(); v_business_id uuid; v_kitchen_id uuid; v_rate integer;
  v_hours numeric; v_subtotal integer; v_fee integer; v_booking_id uuid; v_missing text[];
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_ends_at <= p_starts_at or p_starts_at < now() then raise exception 'Choose a valid future time'; end if;
  if extract(epoch from (p_ends_at-p_starts_at)) < 7200 then raise exception 'Minimum reservation is 2 hours'; end if;
  select bm.business_id into v_business_id from public.business_members bm
  join public.businesses b on b.id=bm.business_id
  where bm.user_id=v_user_id and bm.role='owner' and b.compliance_status='approved'
  order by bm.business_id limit 1;
  if v_business_id is null then raise exception 'An approved Kitchen Passport is required'; end if;
  select array_agg(req) into v_missing
  from unnest(array['food_handler_card','liability_insurance','business_license']) req
  where not exists (
    select 1 from public.credentials c where c.business_id=v_business_id
      and c.credential_type=req and c.status='approved'
      and (c.expires_on is null or c.expires_on>=p_ends_at::date)
      and (req not in ('food_handler_card','liability_insurance') or c.expires_on is not null)
  );
  if cardinality(v_missing)>0 then
    raise exception 'Renew required credentials before booking: %',array_to_string(v_missing,', ');
  end if;
  select er.kitchen_id,er.hourly_rate_cents into v_kitchen_id,v_rate
  from public.equipment_resources er join public.kitchens k on k.id=er.kitchen_id
  where er.id=p_resource_id and er.active and k.active;
  if v_kitchen_id is null then raise exception 'This equipment is not available'; end if;
  if v_rate <= 0 then raise exception 'This equipment is not priced for online booking yet'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_resource_id::text,0));
  if exists (select 1 from public.booking_resources br join public.bookings b on b.id=br.booking_id
    where br.resource_id=p_resource_id and b.status in ('pending_payment','confirmed')
      and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)'))
  or exists (select 1 from public.availability_blocks ab where ab.kitchen_id=v_kitchen_id
    and (ab.scope='whole_kitchen' or (ab.scope='resource' and ab.equipment_resource_id=p_resource_id))
    and ab.kind in ('blocked','resident_priority','maintenance')
    and tstzrange(ab.starts_at,ab.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)'))
  or exists (select 1 from public.chef_assignments ca where ca.kitchen_id=v_kitchen_id
    and ca.business_id<>v_business_id and (ca.equipment_resource_id is null or ca.equipment_resource_id=p_resource_id)
    and tstzrange(ca.starts_at,ca.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)'))
  then raise exception 'That time or equipment is already reserved'; end if;
  v_hours:=ceil(extract(epoch from (p_ends_at-p_starts_at))/3600);
  v_subtotal:=round(v_rate*v_hours); v_fee:=round(v_subtotal*0.10);
  insert into public.bookings(kitchen_id,renter_business_id,created_by,starts_at,ends_at,status,subtotal_cents,platform_fee_cents,host_payout_cents,notes,risk_status)
  values(v_kitchen_id,v_business_id,v_user_id,p_starts_at,p_ends_at,'pending_payment',v_subtotal,v_fee,v_subtotal-v_fee,nullif(trim(p_notes),''),'cleared')
  returning id into v_booking_id;
  insert into public.booking_resources(booking_id,resource_id,hourly_rate_cents) values(v_booking_id,p_resource_id,v_rate);
  return jsonb_build_object('booking_id',v_booking_id,'status','pending_payment','subtotal_cents',v_subtotal,'platform_fee_cents',v_fee,'host_payout_cents',v_subtotal-v_fee);
end;
$$;

create or replace function public.admin_decide_booking_change(p_request_id uuid,p_decision text,p_admin_note text default null)
returns void language plpgsql security invoker set search_path=''
as $$
declare v_req public.booking_change_requests%rowtype; v_booking public.bookings%rowtype;
begin
  if auth.uid() is null or not private.is_platform_staff() then raise exception 'Administrator access required'; end if;
  if p_decision not in ('approved','declined') then raise exception 'Decision must be approved or declined'; end if;
  select * into v_req from public.booking_change_requests where id=p_request_id and status='pending' for update;
  if not found then raise exception 'Pending request not found'; end if;
  select * into v_booking from public.bookings where id=v_req.booking_id for update;
  if p_decision='approved' and v_req.request_type='cancel' then
    update public.bookings set status='cancelled' where id=v_booking.id;
  elsif p_decision='approved' then
    if exists(select 1 from public.booking_resources mine join public.booking_resources other on other.resource_id=mine.resource_id
      join public.bookings b on b.id=other.booking_id where mine.booking_id=v_booking.id and b.id<>v_booking.id
      and b.status in ('pending_payment','confirmed') and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(v_req.requested_starts_at,v_req.requested_ends_at,'[)'))
    or exists(select 1 from public.booking_resources mine join public.availability_blocks ab on ab.kitchen_id=v_booking.kitchen_id
      and (ab.scope='whole_kitchen' or (ab.scope='resource' and ab.equipment_resource_id=mine.resource_id))
      where mine.booking_id=v_booking.id and ab.kind in ('blocked','resident_priority','maintenance')
      and tstzrange(ab.starts_at,ab.ends_at,'[)') && tstzrange(v_req.requested_starts_at,v_req.requested_ends_at,'[)'))
    then raise exception 'The requested time now conflicts with another reservation or block'; end if;
    update public.bookings set starts_at=v_req.requested_starts_at,ends_at=v_req.requested_ends_at where id=v_booking.id;
  end if;
  update public.booking_change_requests set status=p_decision,admin_note=nullif(trim(p_admin_note),''),reviewed_by=auth.uid(),reviewed_at=now() where id=p_request_id;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,details)
  values(auth.uid(),'booking_change_request',p_request_id,'decided',jsonb_build_object('decision',p_decision,'booking_id',v_booking.id));
end;
$$;

create or replace function private.get_inner_schedule_impl(p_from timestamptz,p_to timestamptz)
returns table(entry_id uuid,kitchen_id uuid,resource_id uuid,starts_at timestamptz,ends_at timestamptz,entry_type text,display_name text,resource_name text)
language sql security definer set search_path=''
as $$
  with caller as (
    select bm.business_id from public.business_members bm
    join public.businesses b on b.id=bm.business_id
    where bm.user_id=auth.uid() and b.compliance_status='approved' limit 1
  )
  select b.id,b.kitchen_id,br.resource_id,b.starts_at,b.ends_at,'booking',
    case when b.renter_business_id=(select business_id from caller) then 'Your booking'
         when rb.schedule_identity_visibility='visible' then rb.name else 'Reserved' end,er.name
  from caller,public.bookings b join public.booking_resources br on br.booking_id=b.id
  left join public.equipment_resources er on er.id=br.resource_id join public.businesses rb on rb.id=b.renter_business_id
  where b.status in ('pending_payment','confirmed') and b.starts_at<p_to and b.ends_at>p_from
  union all
  select ca.id,ca.kitchen_id,ca.equipment_resource_id,ca.starts_at,ca.ends_at,'assignment',
    case when ca.business_id=(select business_id from caller) then 'Your assigned time'
         when ca.visibility='business_name' then rb.name else 'Reserved' end,er.name
  from caller,public.chef_assignments ca join public.businesses rb on rb.id=ca.business_id
  left join public.equipment_resources er on er.id=ca.equipment_resource_id
  where ca.starts_at<p_to and ca.ends_at>p_from
  union all
  select ab.id,ab.kitchen_id,ab.equipment_resource_id,ab.starts_at,ab.ends_at,'block',
    case when ab.kind='maintenance' then 'Maintenance' when ab.kind='resident_priority' then 'Resident priority' else ab.title end,
    coalesce(er.name,case when ab.scope='custom' then 'Custom resident footprint · shared equipment' else 'Whole kitchen · exclusive' end)
  from caller,public.availability_blocks ab left join public.equipment_resources er on er.id=ab.equipment_resource_id
  where ab.kind<>'available' and ab.starts_at<p_to and ab.ends_at>p_from order by starts_at;
$$;

revoke all on function public.create_booking_request(uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.create_booking_request(uuid,timestamptz,timestamptz,text) to authenticated;
revoke all on function public.admin_decide_booking_change(uuid,text,text) from public,anon;
grant execute on function public.admin_decide_booking_change(uuid,text,text) to authenticated;
revoke all on function private.get_inner_schedule_impl(timestamptz,timestamptz) from public,anon;
grant execute on function private.get_inner_schedule_impl(timestamptz,timestamptz) to authenticated;
