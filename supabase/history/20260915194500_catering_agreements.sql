create table public.catering_agreements (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.catering_proposals(id) on delete cascade,
  opportunity_id uuid not null references public.catering_opportunities(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  revision integer not null check (revision > 0),
  status text not null check (status in ('pending_customer','changes_requested','accepted','superseded')),
  final_menu text not null,
  service_details text not null,
  event_timing text not null,
  total_cents integer not null check (total_cents > 0),
  cancellation_terms text not null,
  customer_change_note text,
  submitted_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(proposal_id,revision)
);

alter table public.catering_agreements enable row level security;
create policy "customers read own catering agreements" on public.catering_agreements for select to authenticated using (customer_id=(select auth.uid()));
create policy "chefs read own catering agreements" on public.catering_agreements for select to authenticated using ((select private.is_business_member(business_id)));
create policy "staff read catering agreements" on public.catering_agreements for select to authenticated using ((select private.is_platform_staff()));
grant select on public.catering_agreements to authenticated;
grant select,insert,update,delete on public.catering_agreements to service_role;
revoke all on public.catering_agreements from anon;
create index catering_agreements_proposal_revision_idx on public.catering_agreements(proposal_id,revision desc);
