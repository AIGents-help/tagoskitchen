-- Platform Admin must be able to operate the provider workspaces during
-- onboarding and support without becoming a member of each provider business.
create policy "platform staff read equipment"
on public.equipment_resources
for select
to authenticated
using ((select private.is_platform_staff()));

create policy "platform staff create equipment"
on public.equipment_resources
for insert
to authenticated
with check ((select private.is_platform_staff()));

create policy "platform staff update equipment"
on public.equipment_resources
for update
to authenticated
using ((select private.is_platform_staff()))
with check ((select private.is_platform_staff()));

create policy "platform staff create food trucks"
on public.food_trucks
for insert
to authenticated
with check (
  (select private.is_platform_staff())
  and created_by = (select auth.uid())
  and renter_driving_allowed = false
);

create policy "platform staff upload kitchen asset files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'kitchen-assets'
  and (select private.is_platform_staff())
);

create policy "platform staff upload credential files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-credentials'
  and (select private.is_platform_staff())
);
