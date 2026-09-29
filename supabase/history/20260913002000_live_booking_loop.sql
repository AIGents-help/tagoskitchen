create policy "members insert own booking resources"
on public.booking_resources for insert to authenticated
with check (
  exists (
    select 1 from public.bookings b
    where b.id=booking_resources.booking_id
      and b.created_by=(select auth.uid())
      and private.is_business_member(b.renter_business_id)
  )
);

create policy "authenticated read published promotions"
on public.promotions for select to authenticated
using (status='published' and ends_at > now());

create or replace function public.create_booking_request(
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_kitchen_id uuid;
  v_rate integer;
  v_hours numeric;
  v_subtotal integer;
  v_fee integer;
  v_booking_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_ends_at <= p_starts_at or p_starts_at < now() then raise exception 'Choose a valid future time'; end if;
  if extract(epoch from (p_ends_at-p_starts_at)) < 7200 then raise exception 'Minimum reservation is 2 hours'; end if;

  select bm.business_id into v_business_id
  from public.business_members bm
  join public.businesses b on b.id=bm.business_id
  where bm.user_id=v_user_id and bm.role='owner' and b.compliance_status='approved'
  order by bm.business_id limit 1;
  if v_business_id is null then raise exception 'An approved Kitchen Passport is required'; end if;

  select er.kitchen_id,er.hourly_rate_cents into v_kitchen_id,v_rate
  from public.equipment_resources er join public.kitchens k on k.id=er.kitchen_id
  where er.id=p_resource_id and er.active and k.active;
  if v_kitchen_id is null then raise exception 'This equipment is not available'; end if;
  if v_rate <= 0 then raise exception 'This equipment is not priced for online booking yet'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_resource_id::text,0));
  if exists (
    select 1 from public.booking_resources br join public.bookings b on b.id=br.booking_id
    where br.resource_id=p_resource_id and b.status in ('pending_payment','confirmed')
      and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
  ) or exists (
    select 1 from public.availability_blocks ab
    where ab.kitchen_id=v_kitchen_id and (ab.equipment_resource_id is null or ab.equipment_resource_id=p_resource_id)
      and ab.kind in ('blocked','resident_priority','maintenance')
      and tstzrange(ab.starts_at,ab.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
  ) or exists (
    select 1 from public.chef_assignments ca
    where ca.kitchen_id=v_kitchen_id and ca.business_id<>v_business_id
      and (ca.equipment_resource_id is null or ca.equipment_resource_id=p_resource_id)
      and tstzrange(ca.starts_at,ca.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
  ) then raise exception 'That time or equipment is already reserved'; end if;

  v_hours := ceil(extract(epoch from (p_ends_at-p_starts_at))/3600);
  v_subtotal := round(v_rate*v_hours);
  v_fee := round(v_subtotal*0.10);
  insert into public.bookings(kitchen_id,renter_business_id,created_by,starts_at,ends_at,status,subtotal_cents,platform_fee_cents,host_payout_cents,notes,risk_status)
  values(v_kitchen_id,v_business_id,v_user_id,p_starts_at,p_ends_at,'pending_payment',v_subtotal,v_fee,v_subtotal-v_fee,nullif(trim(p_notes),''),'cleared')
  returning id into v_booking_id;
  insert into public.booking_resources(booking_id,resource_id,hourly_rate_cents)
  values(v_booking_id,p_resource_id,v_rate);
  return jsonb_build_object('booking_id',v_booking_id,'status','pending_payment','subtotal_cents',v_subtotal,'platform_fee_cents',v_fee,'host_payout_cents',v_subtotal-v_fee);
end;
$$;
revoke all on function public.create_booking_request(uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.create_booking_request(uuid,timestamptz,timestamptz,text) to authenticated;

create or replace function public.get_inner_schedule(p_from timestamptz,p_to timestamptz)
returns table(entry_id uuid,kitchen_id uuid,resource_id uuid,starts_at timestamptz,ends_at timestamptz,entry_type text,display_name text,resource_name text)
language sql security definer set search_path=''
as $$
  with caller as (
    select bm.business_id
    from public.business_members bm join public.businesses b on b.id=bm.business_id
    where bm.user_id=auth.uid() and b.compliance_status='approved'
    limit 1
  )
  select b.id,b.kitchen_id,br.resource_id,b.starts_at,b.ends_at,'booking',
    case when b.renter_business_id=(select business_id from caller) then 'Your booking'
         when rb.schedule_identity_visibility='visible' then rb.name else 'Reserved' end,
    er.name
  from caller, public.bookings b
  join public.booking_resources br on br.booking_id=b.id
  left join public.equipment_resources er on er.id=br.resource_id
  join public.businesses rb on rb.id=b.renter_business_id
  where b.status in ('pending_payment','confirmed') and b.starts_at<p_to and b.ends_at>p_from
  union all
  select ca.id,ca.kitchen_id,ca.equipment_resource_id,ca.starts_at,ca.ends_at,'assignment',
    case when ca.business_id=(select business_id from caller) then 'Your assigned time'
         when ca.visibility='business_name' then rb.name else 'Reserved' end,
    er.name
  from caller, public.chef_assignments ca
  join public.businesses rb on rb.id=ca.business_id
  left join public.equipment_resources er on er.id=ca.equipment_resource_id
  where ca.starts_at<p_to and ca.ends_at>p_from
  union all
  select ab.id,ab.kitchen_id,ab.equipment_resource_id,ab.starts_at,ab.ends_at,'block',
    case when ab.kind='maintenance' then 'Maintenance' when ab.kind='resident_priority' then 'Resident priority' else ab.title end,
    er.name
  from caller, public.availability_blocks ab
  left join public.equipment_resources er on er.id=ab.equipment_resource_id
  where ab.kind<>'available' and ab.starts_at<p_to and ab.ends_at>p_from
  order by starts_at;
$$;
revoke all on function public.get_inner_schedule(timestamptz,timestamptz) from public,anon;
grant execute on function public.get_inner_schedule(timestamptz,timestamptz) to authenticated;
