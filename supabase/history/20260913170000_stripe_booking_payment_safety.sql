create unique index if not exists booking_transactions_stripe_reference_unique
on public.booking_transactions(payment_provider,external_reference)
where payment_provider='stripe' and external_reference is not null;

create or replace function public.record_stripe_booking_payment(
  p_booking_id uuid,
  p_invoice_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_cents integer,
  p_platform_fee_cents integer,
  p_created_by uuid
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_invoice public.booking_invoices%rowtype;
  v_booking public.bookings%rowtype;
  v_transaction_id uuid;
  v_fee_collected integer;
  v_new_paid integer;
begin
  if p_amount_cents <= 0 or p_platform_fee_cents < 0 then
    raise exception 'Invalid Stripe payment amounts';
  end if;

  select * into v_invoice from public.booking_invoices
  where id=p_invoice_id and booking_id=p_booking_id for update;
  if not found or v_invoice.status='void' then raise exception 'Open invoice not found'; end if;

  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;

  select id into v_transaction_id from public.booking_transactions
  where payment_provider='stripe' and external_reference=p_checkout_session_id;
  if found then return v_transaction_id; end if;

  if p_amount_cents > greatest(0,v_invoice.amount_due_cents-v_invoice.amount_paid_cents) then
    raise exception 'Stripe payment exceeds invoice balance';
  end if;

  select coalesce(sum(platform_fee_cents),0) into v_fee_collected
  from public.booking_transactions where booking_id=p_booking_id and status='succeeded';
  if p_platform_fee_cents > greatest(0,v_booking.platform_fee_cents-v_fee_collected) then
    raise exception 'Stripe platform fee exceeds remaining booking fee';
  end if;

  insert into public.booking_transactions(
    booking_id,kitchen_id,transaction_type,gross_cents,platform_fee_cents,
    provider_net_cents,status,payment_provider,external_reference,created_by,notes
  ) values (
    p_booking_id,v_invoice.kitchen_id,'rent_charge',p_amount_cents,p_platform_fee_cents,
    p_amount_cents-p_platform_fee_cents,'succeeded','stripe',p_checkout_session_id,p_created_by,
    'Stripe Connect destination charge'
  ) returning id into v_transaction_id;

  v_new_paid := v_invoice.amount_paid_cents+p_amount_cents;
  update public.booking_invoices set
    amount_paid_cents=v_new_paid,
    status=case when v_new_paid>=amount_due_cents then 'paid' else 'partially_paid' end,
    updated_at=now()
  where id=p_invoice_id;

  if v_new_paid>=v_invoice.amount_due_cents then
    update public.bookings set status='confirmed',stripe_payment_intent_id=nullif(p_payment_intent_id,'')
    where id=p_booking_id and status='pending_payment';
  end if;

  return v_transaction_id;
end;
$$;

revoke all on function public.record_stripe_booking_payment(uuid,uuid,text,text,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.record_stripe_booking_payment(uuid,uuid,text,text,integer,integer,uuid) to service_role;
