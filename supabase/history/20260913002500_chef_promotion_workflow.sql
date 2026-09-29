create policy "chefs read own promotions"
on public.promotions for select to authenticated
using (private.is_business_member(business_id));

create policy "approved chefs create draft promotions"
on public.promotions for insert to authenticated
with check (
  created_by=(select auth.uid())
  and private.is_business_member(business_id)
  and status in ('draft','scheduled')
  and exists(select 1 from public.businesses b where b.id=business_id and b.compliance_status='approved')
);

create policy "chefs update own unpublished promotions"
on public.promotions for update to authenticated
using (private.is_business_member(business_id) and status in ('draft','scheduled'))
with check (
  private.is_business_member(business_id)
  and status in ('draft','scheduled','cancelled')
);

create index if not exists promotions_business_status_time_idx
on public.promotions(business_id,status,starts_at desc);
