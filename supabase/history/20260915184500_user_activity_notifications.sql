create table public.user_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('proposal_received','proposal_selected','proposal_declined','payment_confirmed','payment_received','review_received')),
  title text not null, body text not null, href text not null default '/', dedupe_key text unique,
  read_at timestamptz, created_at timestamptz not null default now()
);
alter table public.user_notifications enable row level security;
create policy "users read own notifications" on public.user_notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "users update own notifications" on public.user_notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, update on public.user_notifications to authenticated;
grant select, insert, update, delete on public.user_notifications to service_role;
revoke all on public.user_notifications from anon;
create index user_notifications_inbox_idx on public.user_notifications(user_id, created_at desc);

create function private.notify_proposal_activity() returns trigger language plpgsql security definer set search_path = '' as $$
declare target_customer uuid; event_name text;
begin
  if tg_op = 'INSERT' then
    select o.customer_id,o.event_type into target_customer,event_name from public.catering_opportunities o where o.id=new.opportunity_id;
    insert into public.user_notifications(user_id,kind,title,body,href,dedupe_key) values(target_customer,'proposal_received','New proposal received','A chef submitted a menu and quote for '||event_name||'.','/catering/manage','proposal-new-'||new.id::text) on conflict(dedupe_key) do nothing;
  elsif new.status is distinct from old.status and new.status in ('accepted','declined') then
    select o.event_type into event_name from public.catering_opportunities o where o.id=new.opportunity_id;
    insert into public.user_notifications(user_id,kind,title,body,href,dedupe_key)
    select m.user_id,case new.status when 'accepted' then 'proposal_selected' else 'proposal_declined' end,case new.status when 'accepted' then 'Your proposal was selected' else 'Proposal not selected' end,case new.status when 'accepted' then 'The customer selected you for ' else 'The customer selected another chef for ' end||event_name||'.','/chef#jobs','proposal-'||new.status||'-'||new.id::text||'-'||m.user_id::text from public.business_members m where m.business_id=new.business_id on conflict(dedupe_key) do nothing;
  end if; return new;
end; $$;
revoke all on function private.notify_proposal_activity() from public;
create trigger notify_proposal_activity_trigger after insert or update on public.catering_proposals for each row execute function private.notify_proposal_activity();

create function private.notify_catering_payment() returns trigger language plpgsql security definer set search_path = '' as $$
declare event_name text;
begin
  if new.status='succeeded' and (tg_op='INSERT' or old.status is distinct from 'succeeded') then
    select o.event_type into event_name from public.catering_opportunities o where o.id=new.opportunity_id;
    insert into public.user_notifications(user_id,kind,title,body,href,dedupe_key) values(new.customer_id,'payment_confirmed','Catering payment confirmed','Your payment for '||event_name||' is confirmed.','/catering/manage','payment-customer-'||new.id::text) on conflict(dedupe_key) do nothing;
    insert into public.user_notifications(user_id,kind,title,body,href,dedupe_key) select m.user_id,'payment_received','Catering payment received','The customer payment for '||event_name||' is confirmed.','/chef#jobs','payment-chef-'||new.id::text||'-'||m.user_id::text from public.business_members m where m.business_id=new.business_id on conflict(dedupe_key) do nothing;
  end if; return new;
end; $$;
revoke all on function private.notify_catering_payment() from public;
create trigger notify_catering_payment_trigger after insert or update on public.catering_payments for each row execute function private.notify_catering_payment();

create function private.notify_chef_review() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_notifications(user_id,kind,title,body,href,dedupe_key) select m.user_id,'review_received','New verified review','A customer left a '||new.rating::text||'-star review on your public profile.','/food-businesses/'||new.business_id::text,'review-'||new.id::text||'-'||m.user_id::text from public.business_members m where m.business_id=new.business_id on conflict(dedupe_key) do nothing;
  return new;
end; $$;
revoke all on function private.notify_chef_review() from public;
create trigger notify_chef_review_trigger after insert on public.chef_reviews for each row execute function private.notify_chef_review();
