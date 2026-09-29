create or replace function public.select_catering_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_opportunity uuid;
begin
  select p.opportunity_id into target_opportunity from public.catering_proposals p
  join public.catering_opportunities o on o.id = p.opportunity_id
  where p.id = p_proposal_id and o.customer_id = (select auth.uid()) and o.status = 'open' and p.status = 'submitted';
  if target_opportunity is null then raise exception 'This proposal cannot be selected.'; end if;
  update public.catering_proposals set status = case when id = p_proposal_id then 'accepted' else 'declined' end, updated_at = now()
    where opportunity_id = target_opportunity and status = 'submitted';
  update public.catering_opportunities set status = 'matched', updated_at = now() where id = target_opportunity;
end; $$;
revoke all on function public.select_catering_proposal(uuid) from public;
revoke all on function public.select_catering_proposal(uuid) from anon;
grant execute on function public.select_catering_proposal(uuid) to authenticated;
