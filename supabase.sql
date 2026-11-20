-- LEVE VEÍCULOS | BANCO DE DADOS + SEGURANÇA
-- Execute uma única vez no SQL Editor do Supabase.
-- Não use a chave service_role no navegador ou no GitHub.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  version text,
  year_make integer not null,
  year_model integer not null,
  mileage integer not null default 0,
  engine text,
  transmission text not null default 'Automático',
  fuel text not null default 'Flex',
  color text,
  doors integer not null default 4,
  options text[] not null default '{}',
  description text,
  price numeric(12,2) not null default 0,
  cover_image text,
  status text not null default 'available'
    check (status in ('available','reserved','sold')),
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  url text not null,
  position bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists vehicles_status_created_idx
  on public.vehicles(status, created_at desc);
create index if not exists vehicle_images_vehicle_idx
  on public.vehicle_images(vehicle_id, position);

create or replace function public.is_leve_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

alter table public.admin_users enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_images enable row level security;

-- Remoção das políticas antigas torna este script reaplicável.
drop policy if exists "Public read available vehicles" on public.vehicles;
drop policy if exists "Leve Veículos admins manage vehicles" on public.vehicles;
drop policy if exists "Public read images for visible vehicles" on public.vehicle_images;
drop policy if exists "Leve Veículos admins manage vehicle images" on public.vehicle_images;

create policy "Public read available vehicles"
on public.vehicles for select to anon, authenticated
using (status = 'available' or public.is_leve_admin());

create policy "Leve Veículos admins manage vehicles"
on public.vehicles for all to authenticated
using (public.is_leve_admin())
with check (public.is_leve_admin());

create policy "Public read images for visible vehicles"
on public.vehicle_images for select to anon, authenticated
using (
  exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id
      and (v.status = 'available' or public.is_leve_admin())
  )
);

create policy "Leve Veículos admins manage vehicle images"
on public.vehicle_images for all to authenticated
using (public.is_leve_admin())
with check (public.is_leve_admin());

-- Armazenamento público para servir as fotos dos anúncios.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-photos',
  'vehicle-photos',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read Leve Veículos vehicle photos" on storage.objects;
drop policy if exists "Leve Veículos admins upload vehicle photos" on storage.objects;
drop policy if exists "Leve Veículos admins update vehicle photos" on storage.objects;
drop policy if exists "Leve Veículos admins delete vehicle photos" on storage.objects;

create policy "Public read Leve Veículos vehicle photos"
on storage.objects for select to anon, authenticated
using (bucket_id = 'vehicle-photos');

create policy "Leve Veículos admins upload vehicle photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'vehicle-photos' and public.is_leve_admin());

create policy "Leve Veículos admins update vehicle photos"
on storage.objects for update to authenticated
using (bucket_id = 'vehicle-photos' and public.is_leve_admin())
with check (bucket_id = 'vehicle-photos' and public.is_leve_admin());

create policy "Leve Veículos admins delete vehicle photos"
on storage.objects for delete to authenticated
using (bucket_id = 'vehicle-photos' and public.is_leve_admin());

-- PASSOS APÓS EXECUTAR O SCRIPT:
-- 1. Supabase > Authentication > Users > Add user.
-- 2. Crie o usuário administrador com e-mail e senha.
-- 3. Copie o UUID do usuário criado.
-- 4. Execute o comando abaixo substituindo o UUID:
-- insert into public.admin_users(user_id)
-- values ('UUID-DO-ADMIN-AQUI');

-- CARROSSEL, CLIENTES E PERFIS DA EQUIPE
alter table public.admin_users add column if not exists role text not null default 'admin' check (role in ('admin','staff'));

create table if not exists public.site_slides (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_url text not null,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_slides_active_position_idx on public.site_slides(active, position);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  document text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_name_idx on public.customers(name);

alter table public.site_slides enable row level security;
alter table public.customers enable row level security;
drop policy if exists "Public read active Leve slides" on public.site_slides;
drop policy if exists "Admins manage Leve slides" on public.site_slides;
drop policy if exists "Admins manage Leve customers" on public.customers;
create policy "Public read active Leve slides" on public.site_slides for select to anon, authenticated using (active or public.is_leve_admin());
create policy "Admins manage Leve slides" on public.site_slides for all to authenticated using (public.is_leve_admin()) with check (public.is_leve_admin());
create policy "Admins manage Leve customers" on public.customers for all to authenticated using (public.is_leve_admin()) with check (public.is_leve_admin());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('site-media','site-media',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Public read Leve site media" on storage.objects;
drop policy if exists "Admins upload Leve site media" on storage.objects;
drop policy if exists "Admins delete Leve site media" on storage.objects;
create policy "Public read Leve site media" on storage.objects for select to anon,authenticated using (bucket_id='site-media');
create policy "Admins upload Leve site media" on storage.objects for insert to authenticated with check (bucket_id='site-media' and public.is_leve_admin());
create policy "Admins delete Leve site media" on storage.objects for delete to authenticated using (bucket_id='site-media' and public.is_leve_admin());

-- Para autorizar um usuário da equipe, a Edge Function cria a linha em admin_users.
