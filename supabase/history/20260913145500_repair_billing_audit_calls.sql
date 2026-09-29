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
