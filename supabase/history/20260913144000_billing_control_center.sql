create table public.booking_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default ('TAG-' || to_char(now(), 'YYYYMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  kitchen_id uuid not null references public.kitchens(id),
  renter_business_id uuid not null references public.businesses(id),
  amount_due_cents integer not null check (amount_due_cents >= 0),
  deposit_due_cents integer not null default 0 check (deposit_due_cents >= 0 and deposit_due_cents <= amount_due_cents),
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),
  deposit_due_at timestamptz,
  balance_due_at timestamptz,
  status text not null default 'draft' check (status in ('draft','open','partially_paid','paid','overdue','void')),
  notes text,
  issued_by uuid not null references auth.users(id),
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  invoice_id uuid references public.booking_invoices(id),
  requested_by uuid not null references auth.users(id),
  amount_cents integer not null check (amount_cents > 0),
  reason text not null check (length(trim(reason)) >= 5),
  status text not null default 'pending' check (status in ('pending','approved','declined','processed')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  processed_transaction_id uuid references public.booking_transactions(id),
  created_at timestamptz not null default now()
);

create index booking_invoices_renter_status_idx on public.booking_invoices(renter_business_id,status);
create index booking_invoices_kitchen_status_idx on public.booking_invoices(kitchen_id,status);
create index refund_requests_booking_idx on public.refund_requests(booking_id);
create index refund_requests_status_created_idx on public.refund_requests(status,created_at desc);
create unique index refund_requests_one_pending_idx on public.refund_requests(booking_id) where status='pending';

alter table public.booking_invoices enable row level security;
alter table public.refund_requests enable row level security;
revoke all on public.booking_invoices, public.refund_requests from anon, public;
grant select on public.booking_invoices, public.refund_requests to authenticated;
grant insert, update on public.booking_invoices, public.refund_requests to authenticated;

create policy "members read own invoices" on public.booking_invoices for select to authenticated
using (public.is_business_member(renter_business_id));
create policy "providers read facility invoices" on public.booking_invoices for select to authenticated
using (exists(select 1 from public.kitchens k where k.id=kitchen_id and public.is_business_member(k.owner_business_id)));
create policy "staff manage invoices" on public.booking_invoices for all to authenticated
using (exists(select 1 from public.platform_staff s where s.user_id=(select auth.uid())))
with check (exists(select 1 from public.platform_staff s where s.user_id=(select auth.uid())));

create policy "members read own refund requests" on public.refund_requests for select to authenticated
using (exists(select 1 from public.bookings b where b.id=booking_id and public.is_business_member(b.renter_business_id)));
create policy "members request own refunds" on public.refund_requests for insert to authenticated
with check (requested_by=(select auth.uid()) and exists(select 1 from public.bookings b where b.id=booking_id and public.is_business_member(b.renter_business_id)));
create policy "providers read facility refunds" on public.refund_requests for select to authenticated
using (exists(select 1 from public.bookings b join public.kitchens k on k.id=b.kitchen_id where b.id=booking_id and public.is_business_member(k.owner_business_id)));
create policy "staff manage refund requests" on public.refund_requests for all to authenticated
using (exists(select 1 from public.platform_staff s where s.user_id=(select auth.uid())))
with check (exists(select 1 from public.platform_staff s where s.user_id=(select auth.uid())));

create or replace function public.admin_issue_booking_invoice(
  p_booking_id uuid, p_deposit_due_cents integer, p_deposit_due_at timestamptz,
  p_balance_due_at timestamptz, p_notes text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_booking public.bookings%rowtype; v_id uuid;
begin
  if (select auth.uid()) is null or not exists(select 1 from public.platform_staff s where s.user_id=(select auth.uid())) then raise exception 'Administrator access required'; end if;
  select * into v_booking from public.bookings where id=p_booking_id;
  if not found then raise exception 'Booking not found'; end if;
  if p_deposit_due_cents < 0 or p_deposit_due_cents > (v_booking.subtotal_cents + v_booking.security_deposit_cents + v_booking.cleaning_fee_cents) then raise exception 'Invalid deposit amount'; end if;
  insert into public.booking_invoices(booking_id,kitchen_id,renter_business_id,amount_due_cents,deposit_due_cents,deposit_due_at,balance_due_at,status,notes,issued_by,issued_at)
  values(v_booking.id,v_booking.kitchen_id,v_booking.renter_business_id,v_booking.subtotal_cents+v_booking.security_deposit_cents+v_booking.cleaning_fee_cents,p_deposit_due_cents,p_deposit_due_at,p_balance_due_at,'open',nullif(trim(p_notes),''),(select auth.uid()),now())
  on conflict(booking_id) do update set amount_due_cents=excluded.amount_due_cents,deposit_due_cents=excluded.deposit_due_cents,deposit_due_at=excluded.deposit_due_at,balance_due_at=excluded.balance_due_at,notes=excluded.notes,status=case when public.booking_invoices.amount_paid_cents>=excluded.amount_due_cents then 'paid' when public.booking_invoices.amount_paid_cents>0 then 'partially_paid' else 'open' end,updated_at=now()
  returning id into v_id;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,details) values((select auth.uid()),'invoice_issued','booking_invoice',v_id,jsonb_build_object('booking_id',p_booking_id));
  return v_id;
end; $$;

create or replace function public.admin_record_booking_payment(
  p_invoice_id uuid, p_amount_cents integer, p_transaction_type text,
  p_payment_provider text, p_external_reference text default null, p_notes text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_invoice public.booking_invoices%rowtype; v_tx uuid; v_fee integer; v_new_paid integer;
begin
  if (select auth.uid()) is null or not exists(select 1 from public.platform_staff s where s.user_id=(select auth.uid())) then raise exception 'Administrator access required'; end if;
  if p_amount_cents <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_transaction_type not in ('deposit','rent_charge','balance','adjustment') then raise exception 'Invalid payment type'; end if;
  select * into v_invoice from public.booking_invoices where id=p_invoice_id for update;
  if not found or v_invoice.status='void' then raise exception 'Open invoice not found'; end if;
  v_fee := round(p_amount_cents * 0.10);
  insert into public.booking_transactions(booking_id,kitchen_id,transaction_type,gross_cents,platform_fee_cents,provider_net_cents,status,payment_provider,external_reference,created_by,notes)
  values(v_invoice.booking_id,v_invoice.kitchen_id,p_transaction_type,p_amount_cents,v_fee,p_amount_cents-v_fee,'succeeded',p_payment_provider,nullif(trim(p_external_reference),''),(select auth.uid()),nullif(trim(p_notes),'')) returning id into v_tx;
  v_new_paid := v_invoice.amount_paid_cents+p_amount_cents;
  update public.booking_invoices set amount_paid_cents=v_new_paid,status=case when v_new_paid>=amount_due_cents then 'paid' else 'partially_paid' end,updated_at=now() where id=p_invoice_id;
  if v_new_paid>=v_invoice.amount_due_cents then update public.bookings set status='confirmed' where id=v_invoice.booking_id and status='pending_payment'; end if;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,details) values((select auth.uid()),'payment_recorded','booking_transaction',v_tx,jsonb_build_object('invoice_id',p_invoice_id,'amount_cents',p_amount_cents));
  return v_tx;
end; $$;

create or replace function public.submit_refund_request(p_booking_id uuid,p_amount_cents integer,p_reason text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_invoice public.booking_invoices%rowtype; v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
  select i.* into v_invoice from public.booking_invoices i where i.booking_id=p_booking_id and public.is_business_member(i.renter_business_id);
  if not found then raise exception 'Invoice not found'; end if;
  if p_amount_cents<=0 or p_amount_cents>v_invoice.amount_paid_cents then raise exception 'Refund amount exceeds payments received'; end if;
  insert into public.refund_requests(booking_id,invoice_id,requested_by,amount_cents,reason) values(p_booking_id,v_invoice.id,(select auth.uid()),p_amount_cents,trim(p_reason)) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.admin_decide_refund_request(p_request_id uuid,p_decision text,p_admin_note text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if (select auth.uid()) is null or not exists(select 1 from public.platform_staff s where s.user_id=(select auth.uid())) then raise exception 'Administrator access required'; end if;
  if p_decision not in ('approved','declined') then raise exception 'Decision must be approved or declined'; end if;
  update public.refund_requests set status=p_decision,admin_note=nullif(trim(p_admin_note),''),reviewed_by=(select auth.uid()),reviewed_at=now() where id=p_request_id and status='pending';
  if not found then raise exception 'Pending refund request not found'; end if;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,details) values((select auth.uid()),'refund_'||p_decision,'refund_request',p_request_id,jsonb_build_object('note',p_admin_note));
end; $$;

revoke all on function public.admin_issue_booking_invoice(uuid,integer,timestamptz,timestamptz,text) from public,anon;
revoke all on function public.admin_record_booking_payment(uuid,integer,text,text,text,text) from public,anon;
revoke all on function public.submit_refund_request(uuid,integer,text) from public,anon;
revoke all on function public.admin_decide_refund_request(uuid,text,text) from public,anon;
grant execute on function public.admin_issue_booking_invoice(uuid,integer,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.admin_record_booking_payment(uuid,integer,text,text,text,text) to authenticated;
grant execute on function public.submit_refund_request(uuid,integer,text) to authenticated;
grant execute on function public.admin_decide_refund_request(uuid,text,text) to authenticated;
