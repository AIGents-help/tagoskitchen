create or replace function private.provider_update_kitchen_settings(
  p_kitchen_id uuid,p_name text,p_description text,p_email text,p_phone text,
  p_minimum_minutes integer,p_lead_hours integer,p_cancellation text,p_rules text,
  p_accepting boolean,p_weekly_hours jsonb
) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not (
   (select private.is_platform_staff())
   or exists(
     select 1 from public.kitchens k
     join public.business_members bm on bm.business_id=k.owner_business_id
     where k.id=p_kitchen_id and bm.user_id=(select auth.uid())
       and bm.role in ('owner','manager')
   )
 ) then raise exception 'Kitchen owner or Platform Admin access required'; end if;
 if length(trim(p_name))<2 then raise exception 'Kitchen name is required'; end if;
 if p_minimum_minutes not between 30 and 1440 or p_lead_hours not between 0 and 8760 then raise exception 'Invalid booking rules'; end if;
 update public.kitchens set name=trim(p_name),listing_description=nullif(trim(p_description),''),contact_email=nullif(trim(p_email),''),contact_phone=nullif(trim(p_phone),''),minimum_booking_minutes=p_minimum_minutes,booking_lead_hours=p_lead_hours,cancellation_policy=nullif(trim(p_cancellation),''),house_rules=nullif(trim(p_rules),''),accepting_requests=p_accepting,weekly_hours=p_weekly_hours where id=p_kitchen_id;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,details) values((select auth.uid()),'kitchen',p_kitchen_id,'provider_settings_updated',jsonb_build_object('accepting_requests',p_accepting,'platform_admin',(select private.is_platform_staff())));
end; $$;

create or replace function private.provider_update_kitchen_amenities(
  p_kitchen_id uuid,p_amenities text[]
) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not (
   (select private.is_platform_staff())
   or exists(
     select 1 from public.kitchens k
     join public.business_members bm on bm.business_id=k.owner_business_id
     where k.id=p_kitchen_id and bm.user_id=(select auth.uid())
       and bm.role in ('owner','manager')
   )
 ) then raise exception 'Kitchen owner or Platform Admin access required'; end if;
 update public.kitchens set included_amenities=coalesce(p_amenities,'{}') where id=p_kitchen_id;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,details) values((select auth.uid()),'kitchen',p_kitchen_id,'provider_amenities_updated',jsonb_build_object('platform_admin',(select private.is_platform_staff())));
end; $$;

create or replace function private.provider_decide_booking(
  p_booking_id uuid,p_decision text,p_provider_note text,
  p_security_deposit_cents integer default 0,p_cleaning_fee_cents integer default 0,
  p_deposit_due_at timestamptz default null,p_balance_due_at timestamptz default null
) returns void language plpgsql security definer set search_path='' as $$
declare v_b public.bookings%rowtype;v_invoice uuid;
begin
 if p_decision not in ('approved','declined','needs_information') then raise exception 'Invalid decision'; end if;
 if p_security_deposit_cents<0 or p_cleaning_fee_cents<0 then raise exception 'Fees cannot be negative'; end if;
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select b.* into v_b
 from public.bookings b join public.kitchens k on k.id=b.kitchen_id
 where b.id=p_booking_id and (
   (select private.is_platform_staff())
   or exists(
     select 1 from public.business_members bm
     where bm.business_id=k.owner_business_id
       and bm.user_id=(select auth.uid()) and bm.role in ('owner','manager')
   )
 ) for update of b;
 if not found then raise exception 'Booking not found for this kitchen'; end if;
 if v_b.status in ('confirmed','completed','cancelled','refunded') then raise exception 'This booking can no longer be reviewed'; end if;
 insert into public.booking_provider_reviews(booking_id,kitchen_id,decision,provider_note,reviewed_by,reviewed_at) values(v_b.id,v_b.kitchen_id,p_decision,nullif(trim(p_provider_note),''),(select auth.uid()),now()) on conflict(booking_id) do update set decision=excluded.decision,provider_note=excluded.provider_note,reviewed_by=excluded.reviewed_by,reviewed_at=now();
 if p_decision='approved' then
  update public.bookings set security_deposit_cents=p_security_deposit_cents,cleaning_fee_cents=p_cleaning_fee_cents,status='pending_payment' where id=v_b.id;
  insert into public.booking_invoices(booking_id,kitchen_id,renter_business_id,amount_due_cents,deposit_due_cents,deposit_due_at,balance_due_at,status,notes,issued_by,issued_at)
  values(v_b.id,v_b.kitchen_id,v_b.renter_business_id,v_b.subtotal_cents+p_security_deposit_cents+p_cleaning_fee_cents,p_security_deposit_cents,p_deposit_due_at,p_balance_due_at,'open',nullif(trim(p_provider_note),''),(select auth.uid()),now())
  on conflict(booking_id) do update set amount_due_cents=excluded.amount_due_cents,deposit_due_cents=excluded.deposit_due_cents,deposit_due_at=excluded.deposit_due_at,balance_due_at=excluded.balance_due_at,notes=excluded.notes,status=case when public.booking_invoices.amount_paid_cents>=excluded.amount_due_cents then 'paid' when public.booking_invoices.amount_paid_cents>0 then 'partially_paid' else 'open' end,updated_at=now() returning id into v_invoice;
 elsif p_decision='declined' then update public.bookings set status='cancelled' where id=v_b.id;
 else update public.bookings set status='pending_documents' where id=v_b.id; end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,details) values((select auth.uid()),'booking',v_b.id,'provider_'||p_decision,jsonb_build_object('invoice_id',v_invoice,'note',p_provider_note,'platform_admin',(select private.is_platform_staff())));
end; $$;
