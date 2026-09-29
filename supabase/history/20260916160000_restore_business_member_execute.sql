-- Legacy policies still call the public compatibility helper. Keep the
-- exposed wrapper security-invoker and delegate the protected lookup to the
-- private security-definer helper.
create or replace function public.is_business_member(target uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_business_member(target); $$;

grant execute on function public.is_business_member(uuid) to authenticated;
