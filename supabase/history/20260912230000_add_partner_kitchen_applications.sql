create table public.kitchen_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  kitchen_name text not null,
  address_line1 text not null,
  city text not null,
  region text not null,
  postal_code text not null,
  website text,
  facility_type text not null,
  description text,
  equipment text[] not null default '{}',
  amenities text[] not null default '{}',
  availability_notes text not null,
  proposed_hourly_rate_cents integer check (proposed_hourly_rate_cents is null or proposed_hourly_rate_cents >= 0),
  license_path text,
  insurance_path text,
  inspection_path text,
  authorization_path text,
  status text not null default 'draft' check (status in ('draft','submitted','under_review','approved','rejected','more_information')),
  applicant_attested boolean not null default false,
  admin_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kitchen_applications enable row level security;
grant select, insert, update on public.kitchen_applications to authenticated;

create policy "Applicants read their kitchen applications"
on public.kitchen_applications for select to authenticated
using ((select auth.uid()) = applicant_id or (select private.is_platform_staff()));

create policy "Applicants create their kitchen applications"
on public.kitchen_applications for insert to authenticated
with check ((select auth.uid()) = applicant_id and status in ('draft','submitted'));

create policy "Applicants update unfinished kitchen applications"
on public.kitchen_applications for update to authenticated
using (((select auth.uid()) = applicant_id and status in ('draft','more_information')) or (select private.is_platform_staff()))
with check (((select auth.uid()) = applicant_id and status in ('draft','submitted')) or (select private.is_platform_staff()));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('kitchen-applications','kitchen-applications',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "Applicants upload kitchen proof"
on storage.objects for insert to authenticated
with check (bucket_id = 'kitchen-applications' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Applicants and staff read kitchen proof"
on storage.objects for select to authenticated
using (bucket_id = 'kitchen-applications' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_platform_staff())));

create policy "Applicants replace kitchen proof"
on storage.objects for update to authenticated
using (bucket_id = 'kitchen-applications' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'kitchen-applications' and (storage.foldername(name))[1] = (select auth.uid())::text);

create index kitchen_applications_applicant_idx on public.kitchen_applications(applicant_id);
create index kitchen_applications_status_idx on public.kitchen_applications(status);
