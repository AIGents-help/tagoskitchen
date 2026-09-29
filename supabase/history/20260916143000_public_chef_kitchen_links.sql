create or replace function public.get_public_chef_kitchens(p_business_id uuid)
returns table(kitchen_id uuid,kitchen_name text,address_line1 text,city text,region text)
language sql stable security definer set search_path=''
as $$
  select k.id,k.name,k.address_line1,k.city,k.region
  from public.kitchen_chef_relationships r
  join public.kitchens k on k.id=r.kitchen_id
  where r.chef_business_id=p_business_id and r.access_status='active' and k.active=true
    and (r.starts_on is null or r.starts_on<=current_date)
    and (r.ends_on is null or r.ends_on>=current_date)
  order by k.name;
$$;
revoke all on function public.get_public_chef_kitchens(uuid) from public;
grant execute on function public.get_public_chef_kitchens(uuid) to anon,authenticated;
