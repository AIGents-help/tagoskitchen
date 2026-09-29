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
    case when ab.kind='maintenance' then 'Maintenance' when ab.kind='resident_priority' then 'Resident priority' else ab.title end,er.name
  from caller,public.availability_blocks ab left join public.equipment_resources er on er.id=ab.equipment_resource_id
  where ab.kind<>'available' and ab.starts_at<p_to and ab.ends_at>p_from order by starts_at;
$$;
revoke all on function private.get_inner_schedule_impl(timestamptz,timestamptz) from public,anon;
grant execute on function private.get_inner_schedule_impl(timestamptz,timestamptz) to authenticated;

create or replace function public.get_inner_schedule(p_from timestamptz,p_to timestamptz)
returns table(entry_id uuid,kitchen_id uuid,resource_id uuid,starts_at timestamptz,ends_at timestamptz,entry_type text,display_name text,resource_name text)
language sql security invoker set search_path=''
as $$ select * from private.get_inner_schedule_impl(p_from,p_to); $$;
revoke all on function public.get_inner_schedule(timestamptz,timestamptz) from public,anon;
grant execute on function public.get_inner_schedule(timestamptz,timestamptz) to authenticated;
