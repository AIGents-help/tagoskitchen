create policy "accepted chef reads matched opportunity"
on public.catering_opportunities for select to authenticated
using (
  status = 'matched'
  and exists (
    select 1
    from public.catering_proposals p
    where p.opportunity_id = catering_opportunities.id
      and p.status = 'accepted'
      and (select private.is_business_member(p.business_id))
  )
);
