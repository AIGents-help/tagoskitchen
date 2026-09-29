-- Public listings must not evaluate membership helpers that anon cannot call.
-- Membership-only records are available solely to authenticated users.
alter policy "participants read booking resources" on public.booking_resources to authenticated;
alter policy "approved participants read bookings" on public.bookings to authenticated;
alter policy "members read memberships" on public.business_members to authenticated;
alter policy "members read businesses" on public.businesses to authenticated;
alter policy "members read client payments" on public.client_payments to authenticated;
alter policy "members read credentials" on public.credentials to authenticated;

drop policy "public reads active kitchens" on public.kitchens;
create policy "visitors read active kitchens" on public.kitchens
  for select to anon using (active = true);
create policy "members read active or owned kitchens" on public.kitchens
  for select to authenticated
  using (active = true or (select private.is_business_member(owner_business_id)));
