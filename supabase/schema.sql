-- Esquema de la base de datos para Supabase.
-- Pegá todo este archivo en Supabase → SQL Editor → New query → Run.
-- Se puede volver a ejecutar sin perder datos.

create extension if not exists pgcrypto;

-- ---------- Tablas ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  creado timestamptz not null default now(),
  role text not null default 'cliente' check (role in ('admin', 'cliente')),
  nombre text not null default '',
  email text not null default '',
  dni text,
  telefono text,
  direccion text,
  nacimiento date,
  bloqueado boolean not null default false
);

-- Notas internas del productor sobre cada cliente (el cliente no puede leerlas)
create table if not exists public.notas (
  "clienteId" uuid primary key references public.profiles on delete cascade,
  texto text
);

create table if not exists public.polizas (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  "clienteId" uuid not null references public.profiles on delete cascade,
  ramo text,
  compania text,
  numero text,
  bien text,
  cobertura text,
  "vigenciaDesde" date,
  "vigenciaHasta" date,
  prima numeric default 0,
  suma numeric default 0,
  estado text not null default 'activa',
  archivo jsonb
);

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  "polizaId" uuid not null references public.polizas on delete cascade,
  "clienteId" uuid not null references public.profiles on delete cascade,
  periodo text,
  monto numeric default 0,
  vencimiento date,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'informado', 'pagado')),
  "fechaPago" date,
  medio text,
  nota text,
  comprobante jsonb
);

create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  "clienteId" uuid references public.profiles on delete cascade,
  nombre text,
  email text,
  telefono text,
  ramo text,
  detalle text,
  estado text not null default 'nuevo',
  compania text,
  monto numeric,
  respuesta text,
  archivo jsonb,
  respondido timestamptz
);

create table if not exists public.siniestros (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  "clienteId" uuid not null references public.profiles on delete cascade,
  "polizaId" uuid references public.polizas on delete cascade,
  tipo text,
  fecha date,
  lugar text,
  descripcion text,
  archivo jsonb,
  estado text not null default 'denunciado',
  numero text,
  notas jsonb not null default '[]'
);

create index if not exists polizas_cliente on public.polizas ("clienteId");
create index if not exists pagos_cliente on public.pagos ("clienteId");
create index if not exists pagos_poliza on public.pagos ("polizaId");
create index if not exists presupuestos_cliente on public.presupuestos ("clienteId");
create index if not exists siniestros_cliente on public.siniestros ("clienteId");

-- ---------- Funciones auxiliares ----------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and not bloqueado);
$$;

-- Crea el perfil automáticamente cuando se registra un usuario (siempre como cliente)
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, nombre, dni, telefono, direccion, nacimiento)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    new.raw_user_meta_data->>'dni',
    new.raw_user_meta_data->>'telefono',
    new.raw_user_meta_data->>'direccion',
    nullif(new.raw_user_meta_data->>'nacimiento', '')::date
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- Mantiene el email del perfil igual al de la cuenta
create or replace function public.email_actualizado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_email on auth.users;
create trigger on_auth_user_email after update of email on auth.users
  for each row execute function public.email_actualizado();

-- Los clientes solo pueden modificar ciertos campos de sus propios registros
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    new.role := old.role; new.bloqueado := old.bloqueado; new.nombre := old.nombre;
    new.dni := old.dni; new.nacimiento := old.nacimiento;
    -- el email solo cambia cuando cambia el de la cuenta (lo hace email_actualizado)
    if new.email is distinct from (select email from auth.users where id = new.id) then new.email := old.email; end if;
  end if;
  return new;
end $$;

drop trigger if exists proteger_perfil on public.profiles;
create trigger proteger_perfil before update on public.profiles
  for each row execute function public.proteger_perfil();

create or replace function public.proteger_pago() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    if old.estado = 'pagado' or new.estado <> 'informado' then
      raise exception 'Solo podés informar el pago de una cuota pendiente';
    end if;
    new.monto := old.monto; new.periodo := old.periodo; new.vencimiento := old.vencimiento;
    new."polizaId" := old."polizaId"; new."clienteId" := old."clienteId";
  end if;
  return new;
end $$;

drop trigger if exists proteger_pago on public.pagos;
create trigger proteger_pago before update on public.pagos
  for each row execute function public.proteger_pago();

create or replace function public.proteger_presupuesto() returns trigger
language plpgsql security definer set search_path = public as $$
declare nuevo_estado text := new.estado;
begin
  if auth.uid() is not null and not is_admin() then
    if old.estado <> 'respondido' or nuevo_estado not in ('aceptado', 'rechazado') then
      raise exception 'Solo podés aceptar o rechazar una propuesta respondida';
    end if;
    new := old;
    new.estado := nuevo_estado;
  end if;
  return new;
end $$;

drop trigger if exists proteger_presupuesto on public.presupuestos;
create trigger proteger_presupuesto before update on public.presupuestos
  for each row execute function public.proteger_presupuesto();

-- ---------- Seguridad por filas (RLS) ----------

alter table public.profiles enable row level security;
alter table public.notas enable row level security;
alter table public.polizas enable row level security;
alter table public.pagos enable row level security;
alter table public.presupuestos enable row level security;
alter table public.siniestros enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Perfiles
create policy "ver perfiles" on public.profiles for select using (id = auth.uid() or is_admin());
create policy "editar perfiles" on public.profiles for update using (id = auth.uid() or is_admin());
create policy "borrar perfiles" on public.profiles for delete using (is_admin());

-- Notas internas
create policy "notas admin" on public.notas for all using (is_admin()) with check (is_admin());

-- Pólizas
create policy "ver polizas" on public.polizas for select using (is_admin() or ("clienteId" = auth.uid() and is_activo()));
create policy "admin polizas" on public.polizas for all using (is_admin()) with check (is_admin());

-- Pagos
create policy "ver pagos" on public.pagos for select using (is_admin() or ("clienteId" = auth.uid() and is_activo()));
create policy "admin pagos" on public.pagos for all using (is_admin()) with check (is_admin());
create policy "informar pago" on public.pagos for update
  using ("clienteId" = auth.uid() and is_activo()) with check ("clienteId" = auth.uid());

-- Presupuestos (cualquiera puede pedir uno desde la web)
create policy "ver presupuestos" on public.presupuestos for select using (is_admin() or ("clienteId" = auth.uid() and is_activo()));
create policy "admin presupuestos" on public.presupuestos for all using (is_admin()) with check (is_admin());
create policy "pedir presupuesto web" on public.presupuestos for insert to anon, authenticated
  with check ("clienteId" is null and estado = 'nuevo' and respuesta is null and monto is null and archivo is null);
create policy "pedir presupuesto cliente" on public.presupuestos for insert to authenticated
  with check ("clienteId" = auth.uid() and is_activo() and estado = 'nuevo' and respuesta is null and monto is null and archivo is null);
create policy "responder propuesta" on public.presupuestos for update
  using ("clienteId" = auth.uid() and is_activo()) with check ("clienteId" = auth.uid());

-- Siniestros
create policy "ver siniestros" on public.siniestros for select using (is_admin() or ("clienteId" = auth.uid() and is_activo()));
create policy "admin siniestros" on public.siniestros for all using (is_admin()) with check (is_admin());
create policy "denunciar siniestro" on public.siniestros for insert to authenticated
  with check ("clienteId" = auth.uid() and is_activo() and estado = 'denunciado' and notas = '[]'::jsonb
    and exists (select 1 from polizas p where p.id = "polizaId" and p."clienteId" = auth.uid()));

-- ---------- Archivos (pólizas, comprobantes, fotos) ----------
-- Cada archivo se guarda en una carpeta con el id del cliente.

insert into storage.buckets (id, name, public) values ('archivos', 'archivos', false)
  on conflict (id) do nothing;

drop policy if exists "archivos ver" on storage.objects;
drop policy if exists "archivos subir" on storage.objects;
drop policy if exists "archivos borrar" on storage.objects;

create policy "archivos ver" on storage.objects for select
  using (bucket_id = 'archivos' and (is_admin() or ((storage.foldername(name))[1] = auth.uid()::text and is_activo())));
create policy "archivos subir" on storage.objects for insert
  with check (bucket_id = 'archivos' and (is_admin() or ((storage.foldername(name))[1] = auth.uid()::text and is_activo())));
create policy "archivos borrar" on storage.objects for delete
  using (bucket_id = 'archivos' and is_admin());
