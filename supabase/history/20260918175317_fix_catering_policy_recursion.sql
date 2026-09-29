-- Break the catering opportunity/proposal RLS cycle. These helpers evaluate
-- ownership as the function owner, so their table reads do not re-enter the
-- calling table's row-level policies.
create or replace function private.is_accepted_catering_business_member(
  target_opportunity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catering_proposals p
    join public.business_members bm on bm.business_id = p.business_id
    where p.opportunity_id = target_opportunity_id
      and p.status = 'accepted'
      and bm.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_catering_opportunity_customer(
  target_opportunity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catering_opportunities o
    where o.id = target_opportunity_id
      and o.customer_id = (select auth.uid())
  );
$$;

revoke all on function private.is_accepted_catering_business_member(uuid) from public;
revoke all on function private.is_catering_opportunity_customer(uuid) from public;
grant execute on function private.is_accepted_catering_business_member(uuid) to authenticated;
grant execute on function private.is_catering_opportunity_customer(uuid) to authenticated;

drop policy if exists "accepted chef reads matched opportunity"
  on public.catering_opportunities;

create policy "accepted chef reads matched opportunity"
on public.catering_opportunities
for select
to authenticated
using (
  status = 'matched'
  and (select private.is_accepted_catering_business_member(id))
);

drop policy if exists "participants read proposals"
  on public.catering_proposals;

create policy "participants read proposals"
on public.catering_proposals
for select
to authenticated
using (
  (select private.is_business_member(business_id))
  or (select private.is_catering_opportunity_customer(opportunity_id))
  or (select private.is_platform_staff())
);
