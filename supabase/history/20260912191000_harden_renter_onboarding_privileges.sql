-- Renter-facing functions run with the caller's privileges. Narrow RLS policies
-- permit only self-owned records, while the trigger prevents self-approval.
alter function public.complete_renter_onboarding(text,text,text,text,text) security invoker;
alter function public.submit_business_for_review(uuid) security invoker;

create or replace function public.enforce_business_compliance_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.compliance_status is distinct from old.compliance_status
     and not private.is_platform_staff() then
    if not (
      old.compliance_status in ('draft','rejected')
      and new.compliance_status='submitted'
      and exists (
        select 1 from public.credentials c
        where c.business_id=old.id
          and c.credential_type='food_handler_card'
          and c.status in ('pending','approved')
      )
    ) then
      raise exception 'Only TaGo''s staff may change approval status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_business_compliance_change on public.businesses;
create trigger enforce_business_compliance_change before update on public.businesses
for each row execute function public.enforce_business_compliance_change();

create policy "users insert own profile" on public.profiles for insert to authenticated
with check (id=(select auth.uid()));
create policy "users create own business" on public.businesses for insert to authenticated
with check (created_by=(select auth.uid()) and compliance_status='draft');
create policy "members update business profile" on public.businesses for update to authenticated
using (private.is_business_member(id)) with check (private.is_business_member(id));
create policy "owners create own membership" on public.business_members for insert to authenticated
with check (
  user_id=(select auth.uid()) and role='owner'
  and exists (
    select 1 from public.businesses b
    where b.id=business_id and b.created_by=(select auth.uid())
  )
);

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.complete_renter_onboarding(text,text,text,text,text) from public, anon;
grant execute on function public.complete_renter_onboarding(text,text,text,text,text) to authenticated;
revoke all on function public.submit_business_for_review(uuid) from public, anon;
grant execute on function public.submit_business_for_review(uuid) to authenticated;
revoke all on function public.enforce_business_compliance_change() from public, anon, authenticated;
