create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  category text,
  price_cents integer not null default 0 check (price_cents >= 0),
  photo_url text,
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.menu_items enable row level security;
create policy "owners manage menu items" on public.menu_items for all to authenticated
using ((select private.is_business_member(business_id))) with check ((select private.is_business_member(business_id)));
create policy "public reads published menus" on public.menu_items for select to anon, authenticated
using (available and exists (select 1 from public.business_public_profiles p where p.business_id = menu_items.business_id and p.is_published) and (select private.is_approved_business(business_id)));
grant select on public.menu_items to anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;
create index menu_items_business_sort_idx on public.menu_items(business_id, sort_order, created_at);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('menu-images','menu-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy "owners upload menu images" on storage.objects for insert to authenticated
with check (bucket_id='menu-images' and owner_id=(select auth.uid()::text));
create policy "owners update menu images" on storage.objects for update to authenticated
using (bucket_id='menu-images' and owner_id=(select auth.uid()::text)) with check (bucket_id='menu-images' and owner_id=(select auth.uid()::text));
create policy "owners remove menu images" on storage.objects for delete to authenticated
using (bucket_id='menu-images' and owner_id=(select auth.uid()::text));
