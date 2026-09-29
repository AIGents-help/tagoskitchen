create or replace function public.admin_review_credential(
  p_credential_id uuid,
  p_decision text,
  p_note text default null
) returns void
language plpgsql
security invoker
set search_path=''
as $$
declare v_type text; v_expires date;
begin
  if auth.uid() is null or not private.is_platform_staff() then raise exception 'Administrator access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select credential_type,expires_on into v_type,v_expires from public.credentials where id=p_credential_id;
  if not found then raise exception 'Credential not found'; end if;
  if p_decision='approved' and v_type in ('food_handler_card','liability_insurance') and v_expires is null then
    raise exception 'An expiration date is required before this credential can be approved';
  end if;
  if p_decision='approved' and v_expires is not null and v_expires<current_date then
    raise exception 'An expired credential cannot be approved';
  end if;
  update public.credentials set status=p_decision::public.credential_status,
    reviewer_id=auth.uid(),reviewer_note=nullif(trim(p_note),''),reviewed_at=now()
  where id=p_credential_id;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,details)
  values(auth.uid(),'credential',p_credential_id,'reviewed',jsonb_build_object('decision',p_decision));
end;
$$;

revoke all on function public.admin_review_credential(uuid,text,text) from public,anon;
grant execute on function public.admin_review_credential(uuid,text,text) to authenticated;
