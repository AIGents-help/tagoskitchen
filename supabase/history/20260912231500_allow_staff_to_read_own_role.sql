drop policy if exists "platform_staff_no_direct_access" on public.platform_staff;

create policy "Staff can read their own role"
on public.platform_staff for select to authenticated
using ((select auth.uid()) = user_id);

grant select on public.platform_staff to authenticated;
