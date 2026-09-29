create or replace function public.get_my_workspaces()
returns table (
  id uuid,
  name text,
  business_type text,
  compliance_status text,
  schedule_identity_visibility text,
  member_role public.member_role
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id,
         b.name,
         b.business_type,
         b.compliance_status,
         b.schedule_identity_visibility,
         bm.role
    from public.business_members bm
    join public.businesses b on b.id = bm.business_id
   where bm.user_id = (select auth.uid())
   order by b.name;
$$;

revoke all on function public.get_my_workspaces() from public;
revoke all on function public.get_my_workspaces() from anon;
grant execute on function public.get_my_workspaces() to authenticated;
