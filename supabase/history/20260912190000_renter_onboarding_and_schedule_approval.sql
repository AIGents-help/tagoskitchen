alter table public.businesses
  add column if not exists compliance_status text not null default 'draft'
    check (compliance_status in ('draft','submitted','approved','rejected','suspended')),
  add column if not exists schedule_identity_visibility text not null default 'visible'
    check (schedule_identity_visibility in ('visible','blocked'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.complete_renter_onboarding(
  p_full_name text, p_phone text, p_business_name text,
  p_business_type text default null, p_visibility text default 'visible'
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_slug text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_full_name), '') is null or nullif(trim(p_business_name), '') is null then
    raise exception 'Full name and business name are required';
  end if;
  if p_visibility not in ('visible','blocked') then raise exception 'Invalid schedule visibility'; end if;

  insert into public.profiles (id, full_name, phone)
  values (v_user_id, trim(p_full_name), nullif(trim(p_phone), ''))
  on conflict (id) do update set full_name=excluded.full_name, phone=excluded.phone, updated_at=now();

  select bm.business_id into v_business_id
  from public.business_members bm
  where bm.user_id=v_user_id and bm.role='owner'
  order by bm.business_id limit 1;

  if v_business_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(trim(p_business_name)), '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then v_slug := 'kitchen'; end if;
    v_slug := v_slug || '-' || left(replace(v_user_id::text, '-', ''), 8);
    insert into public.businesses
      (name,slug,business_type,created_by,compliance_status,schedule_identity_visibility)
    values
      (trim(p_business_name),v_slug,nullif(trim(p_business_type),''),v_user_id,'draft',p_visibility)
    returning id into v_business_id;
    insert into public.business_members (business_id,user_id,role) values (v_business_id,v_user_id,'owner');
  else
    update public.businesses set name=trim(p_business_name),
      business_type=nullif(trim(p_business_type),''),
      schedule_identity_visibility=p_visibility where id=v_business_id;
  end if;
  return v_business_id;
end;
$$;

create or replace function public.submit_business_for_review(p_business_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_business_member(p_business_id) then raise exception 'Not authorized'; end if;
  if not exists (
    select 1 from public.credentials c where c.business_id=p_business_id
    and c.credential_type='food_handler_card' and c.status in ('pending','approved')
  ) then raise exception 'A food-handler card is required before submission'; end if;
  update public.businesses set compliance_status='submitted'
  where id=p_business_id and compliance_status in ('draft','rejected');
end;
$$;

revoke all on function public.complete_renter_onboarding(text,text,text,text,text) from public;
grant execute on function public.complete_renter_onboarding(text,text,text,text,text) to authenticated;
revoke all on function public.submit_business_for_review(uuid) from public;
grant execute on function public.submit_business_for_review(uuid) to authenticated;

create policy "platform_staff_update_businesses" on public.businesses for update to authenticated
using (private.is_platform_staff()) with check (private.is_platform_staff());
create policy "platform_staff_read_memberships" on public.business_members for select to authenticated
using (private.is_platform_staff());
create policy "credential staff read files" on storage.objects for select to authenticated
using (bucket_id='business-credentials' and private.is_platform_staff());

drop policy if exists "participants read bookings" on public.bookings;
create policy "approved participants read bookings" on public.bookings for select using (
  (private.is_business_member(renter_business_id) and exists (
    select 1 from public.businesses b where b.id=bookings.renter_business_id and b.compliance_status='approved'
  ))
  or exists (
    select 1 from public.kitchens k where k.id=bookings.kitchen_id and private.is_business_member(k.owner_business_id)
  )
);
