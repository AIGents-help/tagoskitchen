alter table public.kitchen_applications
add column approved_kitchen_id uuid references public.kitchens(id) on delete set null;

create index kitchen_applications_approved_kitchen_idx
on public.kitchen_applications(approved_kitchen_id);
