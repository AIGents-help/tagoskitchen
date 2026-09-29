create table public.chef_reviews (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.catering_opportunities(id) on delete cascade,
  proposal_id uuid not null unique references public.catering_proposals(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text not null check (char_length(trim(review_text)) between 20 and 2000),
  created_at timestamptz not null default now()
);

alter table public.chef_reviews enable row level security;

create policy "public reads verified chef reviews"
on public.chef_reviews for select to anon, authenticated
using (
  exists (
    select 1 from public.business_public_profiles bp
    where bp.business_id = chef_reviews.business_id
      and bp.is_published
      and (select private.is_approved_business(bp.business_id))
  )
);

create policy "customers review completed matches"
on public.chef_reviews for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and exists (
    select 1
    from public.catering_opportunities o
    join public.catering_proposals p on p.opportunity_id = o.id
    where o.id = opportunity_id
      and p.id = proposal_id
      and p.business_id = business_id
      and p.status = 'accepted'
      and o.customer_id = (select auth.uid())
      and o.status in ('matched', 'closed')
      and o.event_date <= current_date
  )
);

create policy "customers read own chef reviews"
on public.chef_reviews for select to authenticated
using (customer_id = (select auth.uid()));

create policy "staff manage chef reviews"
on public.chef_reviews for all to authenticated
using ((select private.is_platform_staff()))
with check ((select private.is_platform_staff()));

grant select on public.chef_reviews to anon, authenticated;
grant insert, update, delete on public.chef_reviews to authenticated;

create index chef_reviews_business_created_idx on public.chef_reviews(business_id, created_at desc);
create index chef_reviews_customer_idx on public.chef_reviews(customer_id);
