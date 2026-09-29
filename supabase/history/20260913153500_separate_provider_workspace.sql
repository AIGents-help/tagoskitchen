alter table public.kitchens add column if not exists listing_description text;
alter table public.kitchens add column if not exists contact_email text;
alter table public.kitchens add column if not exists contact_phone text;
alter table public.kitchens add column if not exists timezone text not null default 'America/New_York';
alter table public.kitchens add column if not exists minimum_booking_minutes integer not null default 120 check (minimum_booking_minutes between 30 and 1440);
alter table public.kitchens add column if not exists booking_lead_hours integer not null default 24 check (booking_lead_hours between 0 and 8760);
alter table public.kitchens add column if not exists cancellation_policy text;
alter table public.kitchens add column if not exists house_rules text;
alter table public.kitchens add column if not exists accepting_requests boolean not null default true;
alter table public.kitchens add column if not exists weekly_hours jsonb not null default '{"monday":["06:00","22:00"],"tuesday":["06:00","22:00"],"wednesday":["06:00","22:00"],"thursday":["06:00","22:00"],"friday":["06:00","22:00"],"saturday":["08:00","20:00"],"sunday":null}'::jsonb;

create table public.booking_provider_reviews (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null unique references public.bookings(id) on delete cascade,
 kitchen_id uuid not null references public.kitchens(id),
 decision text not null check(decision in ('approved','declined','needs_information')),
 provider_note text,
 reviewed_by uuid not null references auth.users(id),
 reviewed_at timestamptz not null default now()
);
create index booking_provider_reviews_kitchen_idx on public.booking_provider_reviews(kitchen_id,reviewed_at desc);
create index booking_provider_reviews_reviewer_idx on public.booking_provider_reviews(reviewed_by);
alter table public.booking_provider_reviews enable row level security;
revoke all on public.booking_provider_reviews from anon,public;
grant select on public.booking_provider_reviews to authenticated;
create policy "participants read provider reviews" on public.booking_provider_reviews for select to authenticated using(
 exists(select 1 from public.bookings b join public.kitchens k on k.id=b.kitchen_id where b.id=booking_id and (public.is_business_member(b.renter_business_id) or public.is_business_member(k.owner_business_id)))
 or exists(select 1 from public.platform_staff s where s.user_id=(select auth.uid()))
);

create or replace function private.provider_update_kitchen_settings(
 p_kitchen_id uuid,p_name text,p_description text,p_email text,p_phone text,p_minimum_minutes integer,p_lead_hours integer,p_cancellation text,p_rules text,p_accepting boolean,p_weekly_hours jsonb
) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.kitchens k join public.business_members bm on bm.business_id=k.owner_business_id where k.id=p_kitchen_id and bm.user_id=(select auth.uid()) and bm.role in ('owner','manager')) then raise exception 'Kitchen owner access required'; end if;
 if length(trim(p_name))<2 then raise exception 'Kitchen name is required'; end if;
 if p_minimum_minutes not between 30 and 1440 or p_lead_hours not between 0 and 8760 then raise exception 'Invalid booking rules'; end if;
 update public.kitchens set name=trim(p_name),listing_description=nullif(trim(p_description),''),contact_email=nullif(trim(p_email),''),contact_phone=nullif(trim(p_phone),''),minimum_booking_minutes=p_minimum_minutes,booking_lead_hours=p_lead_hours,cancellation_policy=nullif(trim(p_cancellation),''),house_rules=nullif(trim(p_rules),''),accepting_requests=p_accepting,weekly_hours=p_weekly_hours where id=p_kitchen_id;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,details) values((select auth.uid()),'kitchen',p_kitchen_id,'provider_settings_updated',jsonb_build_object('accepting_requests',p_accepting));
end; $$;

create or replace function private.provider_decide_booking(
 p_booking_id uuid,p_decision text,p_provider_note text,p_security_deposit_cents integer default 0,p_cleaning_fee_cents integer default 0,p_deposit_due_at timestamptz default null,p_balance_due_at timestamptz default null
) returns void language plpgsql security definer set search_path='' as $$
declare v_b public.bookings%rowtype;v_invoice uuid;
begin
 if p_decision not in ('approved','declined','needs_information') then raise exception 'Invalid decision'; end if;
 if p_security_deposit_cents<0 or p_cleaning_fee_cents<0 then raise exception 'Fees cannot be negative'; end if;
 select b.* into v_b from public.bookings b join public.kitchens k on k.id=b.kitchen_id join public.business_members bm on bm.business_id=k.owner_business_id where b.id=p_booking_id and bm.user_id=(select auth.uid()) and bm.role in ('owner','manager') for update of b;
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
 insert into public.audit_events(actor_id,entity_type,entity_id,action,details) values((select auth.uid()),'booking',v_b.id,'provider_'||p_decision,jsonb_build_object('invoice_id',v_invoice,'note',p_provider_note));
end; $$;

create or replace function public.provider_update_kitchen_settings(p_kitchen_id uuid,p_name text,p_description text,p_email text,p_phone text,p_minimum_minutes integer,p_lead_hours integer,p_cancellation text,p_rules text,p_accepting boolean,p_weekly_hours jsonb)
returns void language sql security invoker set search_path='' as $$select private.provider_update_kitchen_settings(p_kitchen_id,p_name,p_description,p_email,p_phone,p_minimum_minutes,p_lead_hours,p_cancellation,p_rules,p_accepting,p_weekly_hours)$$;
create or replace function public.provider_decide_booking(p_booking_id uuid,p_decision text,p_provider_note text,p_security_deposit_cents integer default 0,p_cleaning_fee_cents integer default 0,p_deposit_due_at timestamptz default null,p_balance_due_at timestamptz default null)
returns void language sql security invoker set search_path='' as $$select private.provider_decide_booking(p_booking_id,p_decision,p_provider_note,p_security_deposit_cents,p_cleaning_fee_cents,p_deposit_due_at,p_balance_due_at)$$;

revoke all on function private.provider_update_kitchen_settings(uuid,text,text,text,text,integer,integer,text,text,boolean,jsonb) from public,anon,authenticated;
revoke all on function private.provider_decide_booking(uuid,text,text,integer,integer,timestamptz,timestamptz) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.provider_update_kitchen_settings(uuid,text,text,text,text,integer,integer,text,text,boolean,jsonb) to authenticated;
grant execute on function private.provider_decide_booking(uuid,text,text,integer,integer,timestamptz,timestamptz) to authenticated;
revoke all on function public.provider_update_kitchen_settings(uuid,text,text,text,text,integer,integer,text,text,boolean,jsonb) from public,anon;
revoke all on function public.provider_decide_booking(uuid,text,text,integer,integer,timestamptz,timestamptz) from public,anon;
grant execute on function public.provider_update_kitchen_settings(uuid,text,text,text,text,integer,integer,text,text,boolean,jsonb) to authenticated;
grant execute on function public.provider_decide_booking(uuid,text,text,integer,integer,timestamptz,timestamptz) to authenticated;
