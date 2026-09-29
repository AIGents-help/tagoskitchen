alter table public.equipment_resources add column if not exists image_path text;
alter table public.kitchens add column if not exists included_amenities text[] not null default '{}';

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kitchen-assets','kitchen-assets',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "public reads kitchen assets" on storage.objects;
create policy "public reads kitchen assets" on storage.objects for select to public using(bucket_id='kitchen-assets');
drop policy if exists "providers upload kitchen assets" on storage.objects;
create policy "providers upload kitchen assets" on storage.objects for insert to authenticated with check(bucket_id='kitchen-assets' and exists(select 1 from public.kitchens k where k.id::text=(storage.foldername(name))[1] and private.is_business_member(k.owner_business_id)));
drop policy if exists "providers update kitchen assets" on storage.objects;
create policy "providers update kitchen assets" on storage.objects for update to authenticated using(bucket_id='kitchen-assets' and exists(select 1 from public.kitchens k where k.id::text=(storage.foldername(name))[1] and private.is_business_member(k.owner_business_id))) with check(bucket_id='kitchen-assets' and exists(select 1 from public.kitchens k where k.id::text=(storage.foldername(name))[1] and private.is_business_member(k.owner_business_id)));
drop policy if exists "providers delete kitchen assets" on storage.objects;
create policy "providers delete kitchen assets" on storage.objects for delete to authenticated using(bucket_id='kitchen-assets' and exists(select 1 from public.kitchens k where k.id::text=(storage.foldername(name))[1] and private.is_business_member(k.owner_business_id)));

create or replace function private.provider_update_kitchen_amenities(p_kitchen_id uuid,p_amenities text[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.kitchens k join public.business_members bm on bm.business_id=k.owner_business_id where k.id=p_kitchen_id and bm.user_id=(select auth.uid()) and bm.role in ('owner','manager')) then raise exception 'Kitchen owner access required'; end if;
 update public.kitchens set included_amenities=coalesce(p_amenities,'{}') where id=p_kitchen_id;
end $$;
revoke all on function private.provider_update_kitchen_amenities(uuid,text[]) from public,anon,authenticated;
grant execute on function private.provider_update_kitchen_amenities(uuid,text[]) to authenticated;
create or replace function public.provider_update_kitchen_amenities(p_kitchen_id uuid,p_amenities text[]) returns void language sql security invoker set search_path='' as $$select private.provider_update_kitchen_amenities(p_kitchen_id,p_amenities)$$;
revoke all on function public.provider_update_kitchen_amenities(uuid,text[]) from public,anon;
grant execute on function public.provider_update_kitchen_amenities(uuid,text[]) to authenticated;
