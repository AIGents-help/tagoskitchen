-- Platform staff may create a business shell only under their own audit identity.
-- This supports acting for approved kitchen-sponsored chefs before they claim login.
drop policy if exists "platform_staff_insert_managed_businesses" on public.businesses;
create policy "platform_staff_insert_managed_businesses"
on public.businesses for insert to authenticated
with check (
  (select private.is_platform_staff())
  and created_by = (select auth.uid())
);
