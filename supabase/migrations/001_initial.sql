-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (auto-created on signup via trigger)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  username text,
  avatar_url text,
  created_at timestamptz default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Gardens
create table if not exists gardens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  description text,
  rows int not null default 6,
  cols int not null default 8,
  created_at timestamptz default now()
);

-- Plants
create table if not exists plants (
  id uuid primary key default uuid_generate_v4(),
  garden_id uuid references gardens(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  variety text,
  row int,
  col int,
  planted_date date,
  expected_harvest_date date,
  last_watered timestamptz,
  water_interval_days int,
  health_status text not null default 'healthy'
    check (health_status in ('healthy','needs_water','sick','harvested','dead')),
  total_yield_grams int not null default 0,
  notes text,
  created_at timestamptz default now()
);

-- Harvests
create table if not exists harvests (
  id uuid primary key default uuid_generate_v4(),
  plant_id uuid references plants(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  yield_grams int not null,
  notes text,
  harvested_at timestamptz default now()
);

-- Plant photos
create table if not exists plant_photos (
  id uuid primary key default uuid_generate_v4(),
  plant_id uuid references plants(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  storage_path text not null,
  caption text,
  taken_at timestamptz default now()
);

-- Garden shares
create table if not exists garden_shares (
  id uuid primary key default uuid_generate_v4(),
  garden_id uuid references gardens(id) on delete cascade not null,
  owner_id uuid references profiles(id) on delete cascade not null,
  shared_with_email text not null,
  permission text not null default 'view' check (permission in ('view','edit')),
  created_at timestamptz default now(),
  unique(garden_id, shared_with_email)
);

-- Row Level Security
alter table profiles enable row level security;
alter table gardens enable row level security;
alter table plants enable row level security;
alter table harvests enable row level security;
alter table plant_photos enable row level security;
alter table garden_shares enable row level security;

-- Profiles: users can read/update their own
drop policy if exists "profiles_own" on profiles;
create policy "profiles_own" on profiles for all using (auth.uid() = id);

-- Gardens: owner full access; shared users can view
drop policy if exists "gardens_owner" on gardens;
create policy "gardens_owner" on gardens for all using (auth.uid() = user_id);
drop policy if exists "gardens_shared_view" on gardens;
create policy "gardens_shared_view" on gardens for select
  using (exists (
    select 1 from garden_shares
    where garden_id = gardens.id and shared_with_email = auth.jwt()->>'email'
  ));

-- Plants: owner full access
drop policy if exists "plants_owner" on plants;
create policy "plants_owner" on plants for all using (auth.uid() = user_id);
drop policy if exists "plants_shared_view" on plants;
create policy "plants_shared_view" on plants for select
  using (exists (
    select 1 from garden_shares gs
    join gardens g on g.id = gs.garden_id
    where g.id = plants.garden_id and gs.shared_with_email = auth.jwt()->>'email'
  ));

-- Harvests: owner full access
drop policy if exists "harvests_owner" on harvests;
create policy "harvests_owner" on harvests for all using (auth.uid() = user_id);

-- Photos: owner full access; shared viewers can view
drop policy if exists "photos_owner" on plant_photos;
create policy "photos_owner" on plant_photos for all using (auth.uid() = user_id);
drop policy if exists "photos_shared_view" on plant_photos;
create policy "photos_shared_view" on plant_photos for select
  using (exists (
    select 1 from garden_shares gs
    join plants p on p.id = plant_photos.plant_id
    join gardens g on g.id = p.garden_id
    where gs.garden_id = g.id and gs.shared_with_email = auth.jwt()->>'email'
  ));

-- Garden shares: owner manages
drop policy if exists "shares_owner" on garden_shares;
create policy "shares_owner" on garden_shares for all using (auth.uid() = owner_id);

-- Storage bucket for plant photos
insert into storage.buckets (id, name, public)
  values ('plant-photos', 'plant-photos', true)
  on conflict do nothing;

drop policy if exists "plant_photos_upload" on storage.objects;
create policy "plant_photos_upload" on storage.objects for insert
  with check (bucket_id = 'plant-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "plant_photos_read" on storage.objects;
create policy "plant_photos_read" on storage.objects for select
  using (bucket_id = 'plant-photos');

drop policy if exists "plant_photos_delete" on storage.objects;
create policy "plant_photos_delete" on storage.objects for delete
  using (bucket_id = 'plant-photos' and auth.uid()::text = (storage.foldername(name))[1]);
