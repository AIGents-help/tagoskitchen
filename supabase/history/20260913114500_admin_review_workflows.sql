alter table public.incident_reports
  add column if not exists status text not null default 'open'
    check (status in ('open','investigating','resolved','closed')),
  add column if not exists assigned_to text,
  add column if not exists resolution_notes text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;

create index if not exists incident_reports_status_created_idx
  on public.incident_reports(status,created_at desc);

create or replace function public.admin_review_credential(
  p_credential_id uuid,
  p_decision text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not private.is_platform_staff() then
    raise exception 'Administrator access required';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  update public.credentials
  set status=p_decision::public.credential_status,
      reviewer_id=auth.uid(), reviewer_note=nullif(trim(p_note),''), reviewed_at=now()
  where id=p_credential_id;
  if not found then raise exception 'Credential not found'; end if;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,details)
  values(auth.uid(),'credential',p_credential_id,'reviewed',jsonb_build_object('decision',p_decision));
end;
$$;

create or replace function public.admin_review_business(
  p_business_id uuid,
  p_decision text
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_missing text[];
begin
  if auth.uid() is null or not private.is_platform_staff() then
    raise exception 'Administrator access required';
  end if;
  if p_decision not in ('approved','rejected','suspended') then
    raise exception 'Invalid business decision';
  end if;
  if p_decision='approved' then
    select array_agg(req) into v_missing
    from unnest(array['food_handler_card','liability_insurance','business_license']) req
    where not exists (
      select 1 from public.credentials c
      where c.business_id=p_business_id and c.credential_type=req
        and c.status='approved'
        and (c.expires_on is null or c.expires_on>=current_date)
    );
    if cardinality(v_missing)>0 then
      raise exception 'Required approved credentials missing: %',array_to_string(v_missing,', ');
    end if;
  end if;
  update public.businesses set compliance_status=p_decision where id=p_business_id;
  if not found then raise exception 'Business not found'; end if;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,details)
  values(auth.uid(),'business',p_business_id,'compliance_reviewed',jsonb_build_object('decision',p_decision));
end;
$$;

create or replace function public.admin_approve_kitchen_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_app public.kitchen_applications%rowtype; v_business_id uuid; v_kitchen_id uuid; v_slug text;
begin
  if auth.uid() is null or not private.is_platform_staff() then
    raise exception 'Administrator access required';
  end if;
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

revoke all on function public.admin_review_credential(uuid,text,text) from public,anon;
revoke all on function public.admin_review_business(uuid,text) from public,anon;
revoke all on function public.admin_approve_kitchen_application(uuid) from public,anon;
grant execute on function public.admin_review_credential(uuid,text,text) to authenticated;
grant execute on function public.admin_review_business(uuid,text) to authenticated;
grant execute on function public.admin_approve_kitchen_application(uuid) to authenticated;
