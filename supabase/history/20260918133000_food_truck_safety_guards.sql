create index if not exists food_truck_checklists_completed_by_idx on public.food_truck_checklists(completed_by);
create index if not exists food_truck_documents_driver_idx on public.food_truck_documents(driver_id);
create index if not exists food_truck_requests_driver_idx on public.food_truck_requests(requested_driver_id);
create index if not exists food_trucks_created_by_idx on public.food_trucks(created_by);
create index if not exists food_trucks_source_equipment_idx on public.food_trucks(source_equipment_id);

drop policy if exists "providers manage truck menus" on public.food_truck_menu_items;
create policy "providers add truck menus" on public.food_truck_menu_items
for insert to authenticated with check (exists(select 1 from public.food_trucks t where t.id=truck_id and ((select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))));
create policy "providers update truck menus" on public.food_truck_menu_items
for update to authenticated using (exists(select 1 from public.food_trucks t where t.id=truck_id and ((select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))))
with check (exists(select 1 from public.food_trucks t where t.id=truck_id and ((select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))));
create policy "providers delete truck menus" on public.food_truck_menu_items
for delete to authenticated using (exists(select 1 from public.food_trucks t where t.id=truck_id and ((select private.is_business_member(t.owner_business_id)) or (select private.is_platform_staff()))));

create or replace function private.enforce_food_truck_request_approval()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  required_document_count integer;
  assigned_driver_ready boolean;
  truck_ready boolean;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select status = 'approved'
      and active
      and transportation_policy = 'owner_supplied_driver'
      and not renter_driving_allowed
    into truck_ready
    from public.food_trucks
    where id = new.truck_id;

    select active
      and insurance_approved
      and mvr_reviewed_at is not null
      and truck_orientation_completed_at is not null
      and license_expires_on >= current_date
    into assigned_driver_ready
    from public.food_truck_drivers
    where id = new.requested_driver_id and truck_id = new.truck_id;

    select count(distinct document_type)
    into required_document_count
    from public.food_truck_documents
    where truck_id = new.truck_id
      and status = 'approved'
      and (expires_on is null or expires_on >= current_date)
      and document_type = any (array[
        'Mobile food-facility license','Health inspection','Commissary license / agreement',
        'Vehicle registration','Vehicle inspection','Commercial auto insurance',
        'General liability insurance','Fire suppression inspection','Propane / generator inspection'
      ]);

    if not coalesce(truck_ready, false) then
      raise exception 'Truck must be active, approved, owner-transported, and unavailable for renter driving.';
    end if;
    if not coalesce(assigned_driver_ready, false) then
      raise exception 'An active, insured, trained driver with a current license is required.';
    end if;
    if required_document_count <> 9 then
      raise exception 'All required truck compliance documents must be current and approved.';
    end if;
    if not new.location_permission_confirmed or not new.permits_confirmed then
      raise exception 'Location permission and required event permits must be confirmed.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_food_truck_request_approval on public.food_truck_requests;
create trigger enforce_food_truck_request_approval
before update of status on public.food_truck_requests
for each row execute function private.enforce_food_truck_request_approval();
