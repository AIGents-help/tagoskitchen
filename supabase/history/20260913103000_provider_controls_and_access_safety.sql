create policy "providers manage own equipment" on public.equipment_resources
for all to authenticated
using (exists(select 1 from public.kitchens k where k.id=equipment_resources.kitchen_id and private.is_business_member(k.owner_business_id)))
with check (exists(select 1 from public.kitchens k where k.id=equipment_resources.kitchen_id and private.is_business_member(k.owner_business_id)));

create policy "providers manage own availability" on public.availability_blocks
for all to authenticated
using (exists(select 1 from public.kitchens k where k.id=availability_blocks.kitchen_id and private.is_business_member(k.owner_business_id)))
with check (exists(select 1 from public.kitchens k where k.id=availability_blocks.kitchen_id and private.is_business_member(k.owner_business_id)));

create policy "providers read own maintenance" on public.maintenance_tickets
for select to authenticated
using (exists(select 1 from public.kitchens k where k.id=maintenance_tickets.kitchen_id and private.is_business_member(k.owner_business_id)));
create policy "providers create own maintenance" on public.maintenance_tickets
for insert to authenticated
with check (opened_by=(select auth.uid()) and exists(select 1 from public.kitchens k where k.id=maintenance_tickets.kitchen_id and private.is_business_member(k.owner_business_id)));
create policy "providers update own maintenance" on public.maintenance_tickets
for update to authenticated
using (exists(select 1 from public.kitchens k where k.id=maintenance_tickets.kitchen_id and private.is_business_member(k.owner_business_id)))
with check (exists(select 1 from public.kitchens k where k.id=maintenance_tickets.kitchen_id and private.is_business_member(k.owner_business_id)));

create policy "providers read own payouts" on public.provider_payouts
for select to authenticated
using (exists(select 1 from public.kitchens k where k.id=provider_payouts.kitchen_id and private.is_business_member(k.owner_business_id)));
create policy "providers read own transactions" on public.booking_transactions
for select to authenticated
using (exists(select 1 from public.kitchens k where k.id=booking_transactions.kitchen_id and private.is_business_member(k.owner_business_id)));

drop policy if exists incidents_insert on public.incident_reports;
create policy "participants create incidents" on public.incident_reports
for insert to authenticated
with check (
  reported_by=(select auth.uid()) and (
    (booking_id is not null and exists(
      select 1 from public.bookings b where b.id=incident_reports.booking_id
      and b.kitchen_id=incident_reports.kitchen_id
      and private.is_business_member(b.renter_business_id)
    ))
    or exists(select 1 from public.kitchens k where k.id=incident_reports.kitchen_id and private.is_business_member(k.owner_business_id))
  )
);

create or replace function public.record_booking_access(p_booking_id uuid,p_event_type text,p_items jsonb default '{}'::jsonb,p_notes text default null)
returns bigint language plpgsql security invoker set search_path=''
as $$
declare v_user_id uuid:=auth.uid();v_kitchen_id uuid;v_event_id bigint;v_starts timestamptz;v_ends timestamptz;
begin
 if v_user_id is null then raise exception 'Authentication required';end if;
 if p_event_type not in('check_in','check_out')then raise exception 'Invalid access event';end if;
 select b.kitchen_id,b.starts_at,b.ends_at into v_kitchen_id,v_starts,v_ends from public.bookings b
 where b.id=p_booking_id and b.status='confirmed' and private.is_business_member(b.renter_business_id);
 if v_kitchen_id is null then raise exception 'Confirmed booking not found or access denied';end if;
 if now()<v_starts-interval '2 hours' or now()>v_ends+interval '4 hours' then raise exception 'Check-in and checkout are available only around the reserved time';end if;
 if exists(select 1 from public.access_events ae where ae.booking_id=p_booking_id and ae.user_id=v_user_id and ae.event_type=p_event_type) then raise exception 'This action has already been recorded';end if;
 if p_event_type='check_out' then
  if not(coalesce((p_items->>'dishes_clean')::boolean,false)and coalesce((p_items->>'equipment_off')::boolean,false)and coalesce((p_items->>'lights_off')::boolean,false)and coalesce((p_items->>'surfaces_sanitized')::boolean,false)and coalesce((p_items->>'waste_removed')::boolean,false)and coalesce((p_items->>'doors_secured')::boolean,false))then raise exception 'Every checkout confirmation is required';end if;
  insert into public.booking_checklists(booking_id,kind,completed_by,items,notes)values(p_booking_id,'post_use',v_user_id,p_items,nullif(trim(p_notes),''));
 end if;
 insert into public.access_events(kitchen_id,booking_id,user_id,event_type,details)values(v_kitchen_id,p_booking_id,v_user_id,p_event_type,jsonb_build_object('source','renter_app'))returning id into v_event_id;
 return v_event_id;
end;$$;
revoke all on function public.record_booking_access(uuid,text,jsonb,text) from public,anon;
grant execute on function public.record_booking_access(uuid,text,jsonb,text) to authenticated;
