-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('client', 'owner', 'admin');
create type booking_type as enum ('slot', 'pickup');
create type booking_status as enum ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  full_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CENTERS
-- ============================================================
create table public.centers (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  address text not null,
  city text not null,
  latitude double precision,
  longitude double precision,
  phone text not null,
  cover_image_url text,
  is_active boolean not null default true,
  opens_at time not null default '09:00',
  closes_at time not null default '19:00',
  slot_duration_minutes int not null default 60,
  supports_pickup boolean not null default false,
  pickup_radius_km numeric(5,2) default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_centers_owner on public.centers(owner_id);
create index idx_centers_active on public.centers(is_active);

-- ============================================================
-- SERVICES
-- ============================================================
create table public.services (
  id uuid primary key default uuid_generate_v4(),
  center_id uuid not null references public.centers(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  duration_minutes int not null default 60 check (duration_minutes > 0),
  category text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_services_center on public.services(center_id);

-- ============================================================
-- BOOKINGS
-- ============================================================
create table public.bookings (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  center_id uuid not null references public.centers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  booking_type booking_type not null,
  status booking_status not null default 'pending',
  booking_date date not null,
  slot_time time not null,
  pickup_address text,
  pickup_latitude double precision,
  pickup_longitude double precision,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  notes text,
  price_at_booking numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pickup_requires_address check (
    booking_type <> 'pickup' or pickup_address is not null
  )
);

create index idx_bookings_client on public.bookings(client_id);
create index idx_bookings_center on public.bookings(center_id);
create index idx_bookings_center_date on public.bookings(center_id, booking_date);

-- Prevent double-booking the same slot at the same center
create unique index uniq_center_slot_active
  on public.bookings(center_id, booking_date, slot_time)
  where status not in ('cancelled', 'no_show');

-- ============================================================
-- BLOCKED SLOTS (owner/admin manual holds: maintenance, holidays, etc.)
-- ============================================================
create table public.blocked_slots (
  id uuid primary key default uuid_generate_v4(),
  center_id uuid not null references public.centers(id) on delete cascade,
  blocked_date date not null,
  slot_time time, -- null = entire day blocked
  reason text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_blocked_center_date on public.blocked_slots(center_id, blocked_date);

-- ============================================================
-- updated_at trigger (shared)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_centers_updated before update on public.centers
  for each row execute function public.set_updated_at();
create trigger trg_services_updated before update on public.services
  for each row execute function public.set_updated_at();
create trigger trg_bookings_updated before update on public.bookings
  for each row execute function public.set_updated_at();

-- Auto-create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'New User'), 'client');
  return new;
end; $$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ENABLE RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.centers enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.blocked_slots enable row level security;

-- ============================================================
-- HELPER FUNCTIONS (security definer, avoids recursive RLS reads)
-- ============================================================
create or replace function public.current_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.owns_center(check_center_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.centers
    where id = check_center_id and owner_id = auth.uid()
  );
$$;

-- ============================================================
-- PROFILES
-- ============================================================
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.current_role() = 'admin');

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
  -- role column locked from self-escalation; only admin (via service role) changes roles

create policy "profiles_admin_full"
  on public.profiles for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================
-- CENTERS
-- ============================================================
create policy "centers_public_read_active"
  on public.centers for select
  using (is_active = true or owner_id = auth.uid() or public.current_role() = 'admin');

create policy "centers_owner_insert"
  on public.centers for insert
  with check (owner_id = auth.uid() and public.current_role() = 'owner');

create policy "centers_owner_update_own"
  on public.centers for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "centers_admin_full"
  on public.centers for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================
-- SERVICES
-- ============================================================
create policy "services_public_read_active"
  on public.services for select
  using (is_active = true or public.owns_center(center_id) or public.current_role() = 'admin');

create policy "services_owner_write_own_center"
  on public.services for all
  using (public.owns_center(center_id))
  with check (public.owns_center(center_id));

create policy "services_admin_full"
  on public.services for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================
-- BOOKINGS
-- ============================================================
-- Clients: can create bookings for themselves, can view/cancel their own.
create policy "bookings_client_select_own"
  on public.bookings for select
  using (client_id = auth.uid());

create policy "bookings_client_insert_own"
  on public.bookings for insert
  with check (client_id = auth.uid() and public.current_role() = 'client');

-- Clients may only cancel (status change), never edit price/service/slot after creation,
-- and never touch another client's row.
create policy "bookings_client_cancel_own"
  on public.bookings for update
  using (client_id = auth.uid())
  with check (
    client_id = auth.uid()
    and status = 'cancelled'
    and service_id = service_id -- no-op guard placeholder for clarity; real immutability enforced via trigger below
  );

-- Owners: full visibility + status management for bookings at their own center(s) only.
create policy "bookings_owner_select_own_center"
  on public.bookings for select
  using (public.owns_center(center_id));

create policy "bookings_owner_update_own_center"
  on public.bookings for update
  using (public.owns_center(center_id))
  with check (public.owns_center(center_id));

create policy "bookings_admin_full"
  on public.bookings for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Extra hardening: prevent clients from mutating immutable fields even within their own row.
create or replace function public.enforce_booking_immutability()
returns trigger language plpgsql as $$
begin
  if public.current_role() = 'client' then
    if new.service_id <> old.service_id
       or new.center_id <> old.center_id
       or new.booking_date <> old.booking_date
       or new.slot_time <> old.slot_time
       or new.price_at_booking <> old.price_at_booking
       or new.client_id <> old.client_id then
      raise exception 'Clients may only cancel a booking, not modify it.';
    end if;
  end if;
  return new;
end; $$;

create trigger trg_booking_immutability
  before update on public.bookings
  for each row execute function public.enforce_booking_immutability();

-- ============================================================
-- BLOCKED SLOTS
-- ============================================================
create policy "blocked_slots_public_read"
  on public.blocked_slots for select
  using (true); -- needed so clients can see unavailable slots pre-auth

create policy "blocked_slots_owner_write_own_center"
  on public.blocked_slots for all
  using (public.owns_center(center_id))
  with check (public.owns_center(center_id));

create policy "blocked_slots_admin_full"
  on public.blocked_slots for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');