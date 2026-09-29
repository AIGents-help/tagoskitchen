create policy "providers read booking renter brands" on public.businesses for select to authenticated using(
 exists(select 1 from public.bookings bk join public.kitchens k on k.id=bk.kitchen_id where bk.renter_business_id=businesses.id and public.is_business_member(k.owner_business_id))
);
