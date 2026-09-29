alter table public.equipment_resources
  add column if not exists archived_at timestamptz;

create index if not exists equipment_resources_active_inventory_idx
  on public.equipment_resources(kitchen_id, name)
  where archived_at is null;

comment on column public.equipment_resources.archived_at is
  'Soft-removal timestamp. Historical bookings remain intact while archived equipment is hidden from the active kitchen inventory.';
