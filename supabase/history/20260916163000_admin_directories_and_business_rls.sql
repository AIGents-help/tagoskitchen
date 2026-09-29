-- Break the businesses -> bookings -> businesses policy cycle by moving the
-- provider visibility test behind a private security-definer helper.
create or replace function private.provider_can_read_renter_business(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1
    from public.bookings bk
    join public.kitchens k on k.id = bk.kitchen_id
    where bk.renter_business_id = target
      and private.is_business_member(k.owner_business_id)
  );
$$;

drop policy if exists "providers read booking renter brands" on public.businesses;
create policy "providers read booking renter brands"
on public.businesses for select to authenticated
using ((select private.provider_can_read_renter_business(id)));

drop policy if exists "platform_staff_admin_all_kitchens" on public.kitchens;
create policy "platform_staff_admin_all_kitchens"
on public.kitchens for all to authenticated
using ((select private.is_platform_staff()))
with check ((select private.is_platform_staff()));

create or replace function public.admin_list_chefs()
returns table(
  record_id uuid,
  source text,
  business_id uuid,
  first_name text,
  last_name text,
  display_name text,
  business_name text,
  business_type text,
  email text,
  phone text,
  status text,
  kitchen_ids uuid[],
  kitchen_names text[]
)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_staff() then raise exception 'Administrator access required'; end if;
  return query
  with registered as (
    select b.id record_id, 'business'::text source, b.id business_id,
      nullif(split_part(trim(coalesce(p.full_name,'')), ' ', 1),'') first_name,
      nullif(regexp_replace(trim(coalesce(p.full_name,'')), '^\\S+\\s*', ''),'') last_name,
      nullif(trim(p.full_name),'') display_name,
      b.name business_name, b.business_type, u.email::text email, p.phone,
      b.compliance_status status,
      coalesce(array_agg(distinct k.id) filter (where k.id is not null), '{}'::uuid[]) kitchen_ids,
      coalesce(array_agg(distinct k.name) filter (where k.name is not null), '{}'::text[]) kitchen_names
    from public.businesses b
    left join public.business_members bm on bm.business_id=b.id and bm.role='owner'
    left join public.profiles p on p.id=bm.user_id
    left join auth.users u on u.id=bm.user_id
    left join public.kitchen_chef_relationships r on r.chef_business_id=b.id
    left join public.kitchens k on k.id=r.kitchen_id
    where lower(coalesce(b.business_type,'')) in ('independent chef','caterer','baker','meal-prep business','food truck operator','packaged-food maker')
    group by b.id,p.full_name,p.phone,u.email
  ), sponsored as (
    select s.id record_id, 'sponsored'::text source, s.claimed_business_id business_id,
      nullif(split_part(trim(coalesce(s.chef_name,'')), ' ', 1),'') first_name,
      nullif(regexp_replace(trim(coalesce(s.chef_name,'')), '^\\S+\\s*', ''),'') last_name,
      s.chef_name display_name, s.business_name, s.business_type, s.email, s.phone,
      s.status, array[s.kitchen_id]::uuid[] kitchen_ids, array[k.name]::text[] kitchen_names
    from public.sponsored_chef_profiles s
    join public.kitchens k on k.id=s.kitchen_id
    where s.claimed_business_id is null
  )
  select * from registered union all select * from sponsored;
end;
$$;
revoke all on function public.admin_list_chefs() from public, anon;
grant execute on function public.admin_list_chefs() to authenticated;

create or replace function public.admin_update_chef(
  p_record_id uuid, p_source text, p_display_name text, p_business_name text,
  p_business_type text, p_phone text, p_status text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not private.is_platform_staff() then raise exception 'Administrator access required'; end if;
  if p_status not in ('draft','invited','pending','submitted','approved','rejected','suspended','active','inactive','claimed') then raise exception 'Invalid status'; end if;
  if p_source='business' then
    update public.businesses set name=trim(p_business_name), business_type=trim(p_business_type), compliance_status=p_status where id=p_record_id;
    select user_id into v_user from public.business_members where business_id=p_record_id and role='owner' limit 1;
    if v_user is not null then update public.profiles set full_name=trim(p_display_name), phone=nullif(trim(p_phone),'') where id=v_user; end if;
  elsif p_source='sponsored' then
    update public.sponsored_chef_profiles set chef_name=trim(p_display_name), business_name=trim(p_business_name), business_type=trim(p_business_type), phone=nullif(trim(p_phone),''), status=p_status where id=p_record_id;
  else raise exception 'Invalid chef source';
  end if;
end;
$$;
revoke all on function public.admin_update_chef(uuid,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_update_chef(uuid,text,text,text,text,text,text) to authenticated;
