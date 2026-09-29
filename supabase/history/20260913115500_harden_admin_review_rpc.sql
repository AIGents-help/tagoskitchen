create index if not exists incident_reports_resolved_by_idx on public.incident_reports(resolved_by);

create policy platform_staff_audit_insert on public.audit_events
for insert to authenticated
with check ((select private.is_platform_staff()) and actor_id=(select auth.uid()));

alter function public.admin_review_credential(uuid,text,text) security invoker;
alter function public.admin_review_business(uuid,text) security invoker;

-- This workflow creates an owner membership and therefore needs controlled elevation.
-- Keep the elevated implementation out of the exposed API schema; the public
-- wrapper remains invoker-rights and the private function verifies staff again.
alter function public.admin_approve_kitchen_application(uuid) rename to admin_approve_kitchen_application_legacy;
revoke all on function public.admin_approve_kitchen_application_legacy(uuid) from public,anon,authenticated;

create or replace function private.admin_approve_kitchen_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_app public.kitchen_applications%rowtype; v_business_id uuid; v_kitchen_id uuid; v_slug text;
begin
  if auth.uid() is null or not private.is_platform_staff() then raise exception 'Administrator access required'; end if;
  select * into v_app from public.kitchen_applications where id=p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_app.status='approved' and v_app.approved_kitchen_id is not null then return v_app.approved_kitchen_id; end if;
  if v_app.license_path is null or v_app.insurance_path is null or v_app.inspection_path is null or not v_app.applicant_attested then
    raise exception 'License, insurance, inspection and owner attestation are required';
  end if;
  v_slug:=trim(both '-' from regexp_replace(lower(v_app.kitchen_name),'[^a-z0-9]+','-','g'))||'-'||left(replace(v_app.id::text,'-',''),8);
  insert into public.businesses(name,slug,business_type,description,created_by,compliance_status)
  values(v_app.kitchen_name,v_slug,'kitchen_provider',v_app.description,v_app.applicant_id,'approved') returning id into v_business_id;
  insert into public.business_members(business_id,user_id,role) values(v_business_id,v_app.applicant_id,'owner');
  insert into public.kitchens(owner_business_id,name,slug,address_line1,city,region,postal_code,description,license_status,active)
  values(v_business_id,v_app.kitchen_name,v_slug,v_app.address_line1,v_app.city,v_app.region,v_app.postal_code,v_app.description,'verified',false)
  returning id into v_kitchen_id;
  update public.kitchen_applications set status='approved',approved_kitchen_id=v_kitchen_id,reviewed_at=now(),updated_at=now() where id=p_application_id;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,details)
  values(auth.uid(),'kitchen_application',p_application_id,'approved',jsonb_build_object('kitchen_id',v_kitchen_id,'business_id',v_business_id));
  return v_kitchen_id;
end;
$$;

revoke all on function private.admin_approve_kitchen_application(uuid) from public,anon;
grant execute on function private.admin_approve_kitchen_application(uuid) to authenticated;

create or replace function public.admin_approve_kitchen_application(p_application_id uuid)
returns uuid language sql security invoker set search_path=''
as $$ select private.admin_approve_kitchen_application(p_application_id) $$;
revoke all on function public.admin_approve_kitchen_application(uuid) from public,anon;
grant execute on function public.admin_approve_kitchen_application(uuid) to authenticated;

drop function public.admin_approve_kitchen_application_legacy(uuid);
