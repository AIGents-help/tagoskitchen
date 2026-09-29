drop policy if exists "providers manage own availability" on public.availability_blocks;

create policy "providers view kitchen availability" on public.availability_blocks
for select to authenticated
using (exists (select 1 from public.kitchens k where k.id = availability_blocks.kitchen_id and private.is_business_member(k.owner_business_id)));

create policy "providers create own availability" on public.availability_blocks
for insert to authenticated
with check ((select auth.uid()) = created_by and exists (select 1 from public.kitchens k where k.id = availability_blocks.kitchen_id and private.is_business_member(k.owner_business_id)));

create policy "creators update own availability" on public.availability_blocks
for update to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by and exists (select 1 from public.kitchens k where k.id = availability_blocks.kitchen_id and private.is_business_member(k.owner_business_id)));

create policy "creators delete own availability" on public.availability_blocks
for delete to authenticated
using ((select auth.uid()) = created_by);
