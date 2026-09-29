create table public.booking_change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('cancel','reschedule')),
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  reason text not null check (char_length(trim(reason))>=5),
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (request_type='cancel' or (requested_starts_at is not null and requested_ends_at is not null and requested_ends_at>requested_starts_at))
);
create unique index booking_change_one_pending_idx on public.booking_change_requests(booking_id) where status='pending';
create index booking_change_requester_idx on public.booking_change_requests(requested_by,created_at desc);
create index booking_change_status_idx on public.booking_change_requests(status,created_at);
create index booking_change_reviewed_by_idx on public.booking_change_requests(reviewed_by);
alter table public.booking_change_requests enable row level security;
grant select,insert,update on public.booking_change_requests to authenticated;
revoke all on public.booking_change_requests from anon;

create policy "renters read own booking changes" on public.booking_change_requests for select to authenticated
using (requested_by=(select auth.uid()) and exists(select 1 from public.bookings b where b.id=booking_id and private.is_business_member(b.renter_business_id)));
create policy "providers read facility booking changes" on public.booking_change_requests for select to authenticated
using (exists(select 1 from public.bookings b join public.kitchens k on k.id=b.kitchen_id where b.id=booking_id and private.is_business_member(k.owner_business_id)));
create policy "renters create own booking changes" on public.booking_change_requests for insert to authenticated
with check (requested_by=(select auth.uid()) and status='pending' and exists(select 1 from public.bookings b where b.id=booking_id and private.is_business_member(b.renter_business_id)));
create policy "staff manage booking changes" on public.booking_change_requests for all to authenticated
using ((select private.is_platform_staff())) with check ((select private.is_platform_staff()));

create or replace function public.submit_booking_change(
  p_booking_id uuid,p_request_type text,p_reason text,
  p_requested_starts_at timestamptz default null,p_requested_ends_at timestamptz default null
) returns uuid language plpgsql security invoker set search_path=''
as $$
declare v_id uuid; v_status public.booking_status; v_start timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_request_type not in ('cancel','reschedule') then raise exception 'Invalid request type'; end if;
  if char_length(trim(coalesce(p_reason,'')))<5 then raise exception 'Please provide a reason'; end if;
  select status,starts_at into v_status,v_start from public.bookings
  where id=p_booking_id and private.is_business_member(renter_business_id);
  if not found then raise exception 'Booking not found or access denied'; end if;
  if v_status not in ('pending_payment','confirmed') or v_start<=now() then raise exception 'This booking can no longer be changed online'; end if;
  if p_request_type='reschedule' and (p_requested_starts_at is null or p_requested_ends_at is null or p_requested_starts_at<=now() or p_requested_ends_at<=p_requested_starts_at) then raise exception 'Choose a valid future time'; end if;
  insert into public.booking_change_requests(booking_id,requested_by,request_type,requested_starts_at,requested_ends_at,reason)
  values(p_booking_id,auth.uid(),p_request_type,p_requested_starts_at,p_requested_ends_at,trim(p_reason)) returning id into v_id;
  return v_id;
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
      and (ab.equipment_resource_id is null or ab.equipment_resource_id=mine.resource_id)
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

revoke all on function public.submit_booking_change(uuid,text,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.submit_booking_change(uuid,text,text,timestamptz,timestamptz) to authenticated;
revoke all on function public.admin_decide_booking_change(uuid,text,text) from public,anon;
grant execute on function public.admin_decide_booking_change(uuid,text,text) to authenticated;
