alter table public.resident_invoices
  add column due_at date,
  add column source text not null default 'manual' check (source in ('manual','recurring'));

create table public.resident_billing_schedules (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  sponsored_profile_id uuid not null references public.sponsored_chef_profiles(id) on delete cascade,
  relationship_id uuid references public.kitchen_chef_relationships(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  due_day integer not null default 1 check (due_day between 1 and 28),
  starts_on date not null,
  ends_on date,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sponsored_profile_id)
);

alter table public.resident_billing_schedules enable row level security;
create policy "providers manage resident billing schedules" on public.resident_billing_schedules for all to authenticated
using (exists(select 1 from public.kitchens k where k.id=kitchen_id and private.is_business_member(k.owner_business_id)))
with check (created_by=(select auth.uid()) and exists(select 1 from public.kitchens k where k.id=kitchen_id and private.is_business_member(k.owner_business_id)));
create policy "staff manage resident billing schedules" on public.resident_billing_schedules for all to authenticated
using ((select private.is_platform_staff())) with check ((select private.is_platform_staff()));
grant select,insert,update,delete on public.resident_billing_schedules to authenticated;
revoke all on public.resident_billing_schedules from anon;
create index resident_billing_schedules_due_idx on public.resident_billing_schedules(active,due_day,kitchen_id);

create function private.generate_due_resident_invoices(target_date date default current_date)
returns integer language plpgsql security definer set search_path='' as $$
declare created_count integer;
begin
  insert into public.resident_invoices(kitchen_id,sponsored_profile_id,relationship_id,billing_period,due_at,amount_due_cents,recipient_email,notes,status,source,issued_by,issued_at)
  select s.kitchen_id,s.sponsored_profile_id,s.relationship_id,date_trunc('month',target_date)::date,
    (date_trunc('month',target_date)+(s.due_day-1)*interval '1 day')::date,s.amount_cents,p.email,
    'Recurring resident commissary kitchen rent','open','recurring',s.created_by,now()
  from public.resident_billing_schedules s
  join public.sponsored_chef_profiles p on p.id=s.sponsored_profile_id
  where s.active and s.starts_on <= target_date and (s.ends_on is null or s.ends_on >= date_trunc('month',target_date)::date)
    and s.due_day <= extract(day from target_date)
  on conflict(sponsored_profile_id,billing_period) do nothing;
  get diagnostics created_count = row_count;
  return created_count;
end; $$;
revoke all on function private.generate_due_resident_invoices(date) from public;

create function private.generate_first_resident_invoice() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.generate_due_resident_invoices(current_date);
  return new;
end; $$;
revoke all on function private.generate_first_resident_invoice() from public;
create trigger generate_first_resident_invoice_trigger after insert or update of active,amount_cents,due_day,starts_on,ends_on on public.resident_billing_schedules for each statement execute function private.generate_first_resident_invoice();

create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
  if not exists(select 1 from cron.job where jobname='generate-due-resident-invoices') then
    perform cron.schedule('generate-due-resident-invoices','15 5 * * *','select private.generate_due_resident_invoices(current_date);');
  end if;
end $$;
