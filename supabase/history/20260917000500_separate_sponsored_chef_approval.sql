-- Keep invitation lifecycle separate from compliance approval. A sponsored chef
-- can be approved while their invitation remains available to claim.
alter table public.sponsored_chef_profiles
  add column if not exists compliance_status text not null default 'draft'
  check (compliance_status in ('draft','submitted','approved','rejected','suspended'));

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
      s.compliance_status status, array[s.kitchen_id]::uuid[] kitchen_ids, array[k.name]::text[] kitchen_names
    from public.sponsored_chef_profiles s
    join public.kitchens k on k.id=s.kitchen_id
    where s.claimed_business_id is null
  )
  select * from registered union all select * from sponsored;
end;
$$;

create or replace function public.admin_update_chef(
  p_record_id uuid, p_source text, p_display_name text, p_business_name text,
  p_business_type text, p_phone text, p_status text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not private.is_platform_staff() then raise exception 'Administrator access required'; end if;
  if p_status not in ('draft','submitted','approved','rejected','suspended') then raise exception 'Invalid compliance status'; end if;
  if p_source='business' then
    update public.businesses set name=trim(p_business_name), business_type=trim(p_business_type), compliance_status=p_status where id=p_record_id;
    select user_id into v_user from public.business_members where business_id=p_record_id and role='owner' limit 1;
    if v_user is not null then update public.profiles set full_name=trim(p_display_name), phone=nullif(trim(p_phone),'') where id=v_user; end if;
  elsif p_source='sponsored' then
    update public.sponsored_chef_profiles
      set chef_name=trim(p_display_name), business_name=trim(p_business_name), business_type=trim(p_business_type),
          phone=nullif(trim(p_phone),''), compliance_status=p_status
      where id=p_record_id;
  else raise exception 'Invalid chef source';
  end if;
end;
$$;

create or replace function public.claim_sponsored_chef_profile()
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid()); v_email text; v_invite public.sponsored_chef_profiles; v_business uuid;
begin
  if v_user is null then return null; end if;
  select lower(email) into v_email from auth.users where id=v_user;
  select * into v_invite from public.sponsored_chef_profiles where lower(email)=v_email and status='invited' order by created_at limit 1 for update;
  if v_invite.id is null then return null; end if;
  insert into public.businesses(name,business_type,compliance_status,schedule_identity_visibility)
    values(v_invite.business_name,v_invite.business_type,v_invite.compliance_status,'visible') returning id into v_business;
  insert into public.business_members(business_id,user_id,role) values(v_business,v_user,'owner');
  update public.profiles set full_name=coalesce(nullif(full_name,''),v_invite.chef_name),phone=coalesce(phone,v_invite.phone) where id=v_user;
  update public.sponsored_chef_profiles set status='claimed',claimed_by=v_user,claimed_business_id=v_business,claimed_at=now() where id=v_invite.id;
  return v_business;
end; $$;
