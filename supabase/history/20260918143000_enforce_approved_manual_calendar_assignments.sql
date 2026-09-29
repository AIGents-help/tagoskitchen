-- Kitchen providers may schedule only chefs who are active at this location,
-- approved by TaGo's, and valid for the entire assigned time window.
drop policy if exists "providers create own availability" on public.availability_blocks;
create policy "providers create own availability" on public.availability_blocks
for insert to authenticated
with check (
  (select auth.uid()) = created_by
  and exists (
    select 1 from public.kitchens k
    where k.id = availability_blocks.kitchen_id
      and private.is_business_member(k.owner_business_id)
  )
  and (
    (assigned_business_id is null and assigned_sponsored_profile_id is null)
    or exists (
      select 1
      from public.kitchen_chef_relationships r
      left join public.businesses b on b.id = r.chef_business_id
      left join public.sponsored_chef_profiles s on s.id = r.sponsored_profile_id
      where r.kitchen_id = availability_blocks.kitchen_id
        and r.access_status = 'active'
        and (r.starts_on is null or r.starts_on <= availability_blocks.starts_at::date)
        and (r.ends_on is null or r.ends_on >= availability_blocks.ends_at::date)
        and (
          (assigned_business_id is not null and r.chef_business_id = assigned_business_id and b.compliance_status = 'approved')
          or
          (assigned_sponsored_profile_id is not null and r.sponsored_profile_id = assigned_sponsored_profile_id and s.compliance_status = 'approved')
        )
    )
  )
);

drop policy if exists "creators update own availability" on public.availability_blocks;
create policy "creators update own availability" on public.availability_blocks
for update to authenticated
using ((select auth.uid()) = created_by)
with check (
  (select auth.uid()) = created_by
  and exists (
    select 1 from public.kitchens k
    where k.id = availability_blocks.kitchen_id
      and private.is_business_member(k.owner_business_id)
  )
  and (
    (assigned_business_id is null and assigned_sponsored_profile_id is null)
    or exists (
      select 1
      from public.kitchen_chef_relationships r
      left join public.businesses b on b.id = r.chef_business_id
      left join public.sponsored_chef_profiles s on s.id = r.sponsored_profile_id
      where r.kitchen_id = availability_blocks.kitchen_id
        and r.access_status = 'active'
        and (r.starts_on is null or r.starts_on <= availability_blocks.starts_at::date)
        and (r.ends_on is null or r.ends_on >= availability_blocks.ends_at::date)
        and (
          (assigned_business_id is not null and r.chef_business_id = assigned_business_id and b.compliance_status = 'approved')
          or
          (assigned_sponsored_profile_id is not null and r.sponsored_profile_id = assigned_sponsored_profile_id and s.compliance_status = 'approved')
        )
    )
  )
);
