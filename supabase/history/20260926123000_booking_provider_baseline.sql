-- Earlier booking/provider SQL was applied outside the migration ledger.
-- Record a checked baseline without replaying its non-idempotent statements.
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'booking_status'
      and e.enumlabel = 'requested'
  ) then
    raise exception 'Booking request status is missing';
  end if;

  if (select count(*) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in (
        'create_booking_request', 'admin_create_booking_request',
        'provider_decide_booking', 'admin_prepare_chef_workspace'
      )) < 4 then
    raise exception 'Booking or administrator function is missing';
  end if;

  if (select count(*) from pg_policies where schemaname = 'public'
      and (tablename, policyname) in (
        ('booking_resources', 'platform staff read booking resources'),
        ('booking_resources', 'platform staff create booking resources'),
        ('equipment_resources', 'platform staff read equipment'),
        ('equipment_resources', 'platform staff create equipment'),
        ('equipment_resources', 'platform staff update equipment'),
        ('food_trucks', 'platform staff create food trucks'),
        ('food_trucks', 'providers update food trucks'),
        ('kitchens', 'platform_staff_admin_all_kitchens')
      )) < 8 then
    raise exception 'Booking or provider access policy is missing';
  end if;
end $$;
