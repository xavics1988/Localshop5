-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('cliente', 'colaborador');
create type order_status as enum (
  'Nuevo', 'En Proceso', 'Completado',
  'Devolución Solicitada', 'Devuelto', 'Cancelado'
);
create type gender_type as enum ('Hombre', 'Mujer', 'Niños');

-- ============================================================
-- TABLE: profiles
-- Extiende auth.users 1-a-1. id = UUID de auth.users.
-- ============================================================
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null,
  location        text not null default '',
  email           text not null,
  bio             text not null default '',
  phone           text not null default '',
  avatar          text,
  store_id        text,
  role            user_role not null default 'cliente',
  referral_code   text unique,
  referred_by     text,
  referral_balance numeric(10,2) not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- TABLE: stores
-- Usa text PK para mantener compatibilidad con IDs semilla ('1','2','3','sol-y-luna')
-- ============================================================
create table stores (
  id              text primary key,
  name            text not null,
  business_name   text,
  category        text not null default '',
  image_url       text not null default '',
  address         text,
  description     text,
  rating          numeric(3,1),
  cif             text,
  contact_email   text,
  contact_phone   text,
  iban            text,
  owner_id        uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- TABLE: products
-- ============================================================
create table products (
  id              text primary key,
  name            text not null,
  price           numeric(10,2) not null,
  store_name      text not null,
  store_id        text not null references stores(id) on delete cascade,
  image_url       text not null default '',
  description     text,
  sizes           text[],
  images          text[],
  category        text,
  gender          gender_type,
  color           text,
  stock           integer not null default 0,
  stock_per_size  jsonb,
  barcode         text,
  is_deleted      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger products_updated_at
  before update on products
  for each row execute procedure update_updated_at();

-- ============================================================
-- TABLE: orders
-- items y history como JSONB para preservar estructura actual sin join tables adicionales
-- ============================================================
create table orders (
  id                  text primary key,
  customer_id         uuid not null references profiles(id) on delete cascade,
  customer_name       text not null,
  date                timestamptz not null default now(),
  status              order_status not null default 'Nuevo',
  items               jsonb not null default '[]',
  total               numeric(10,2) not null,
  destination_iban    text,
  history             jsonb not null default '[]',
  created_at          timestamptz not null default now()
);

-- ============================================================
-- TABLE: reviews
-- ============================================================
create table reviews (
  id          text primary key,
  store_id    text not null references stores(id) on delete cascade,
  user_name   text not null,
  rating      integer not null check (rating between 1 and 5),
  comment     text not null default '',
  date        text not null,
  author_id   uuid references profiles(id) on delete set null
);

-- ============================================================
-- TABLE: cart_items  (reemplaza cart_{userId})
-- ============================================================
create table cart_items (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  product_id  text not null references products(id) on delete cascade,
  quantity    integer not null default 1,
  variant     text
);

create unique index cart_items_unique_idx
  on cart_items (user_id, product_id, coalesce(variant, ''));

-- ============================================================
-- TABLE: favorites  (reemplaza favorites_{userId})
-- ============================================================
create table favorites (
  user_id     uuid not null references profiles(id) on delete cascade,
  product_id  text not null references products(id) on delete cascade,
  primary key (user_id, product_id)
);

-- ============================================================
-- TABLE: followed_stores  (reemplaza followedStores_{userId})
-- ============================================================
create table followed_stores (
  user_id   uuid not null references profiles(id) on delete cascade,
  store_id  text not null references stores(id) on delete cascade,
  primary key (user_id, store_id)
);

-- ============================================================
-- TABLE: payment_cards  (reemplaza payment_methods_{userId})
-- ============================================================
create table payment_cards (
  id        uuid primary key default uuid_generate_v4(),
  user_id   uuid not null references profiles(id) on delete cascade,
  last4     text not null,
  brand     text not null,
  expiry    text not null,
  holder    text not null
);

-- ============================================================
-- TABLE: bank_accounts  (reemplaza bank_accounts_{userId})
-- ============================================================
create table bank_accounts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  holder      text not null,
  iban        text not null,
  bank_name   text not null,
  bic         text,
  is_default  boolean not null default false
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- profiles --
alter table profiles enable row level security;
create policy "profiles: lectura publica" on profiles for select using (true);
create policy "profiles: owner escribe" on profiles for insert with check (auth.uid() = id);
create policy "profiles: owner actualiza" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- stores --
alter table stores enable row level security;
create policy "stores: lectura publica" on stores for select using (true);
create policy "stores: owner inserta" on stores for insert with check (auth.uid() = owner_id or owner_id is null);
create policy "stores: owner actualiza" on stores for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "stores: owner elimina" on stores for delete using (auth.uid() = owner_id);

-- products --
alter table products enable row level security;
create policy "products: lectura publica no eliminados" on products for select using (is_deleted = false);
create policy "products: store owner inserta" on products for insert
  with check (
    exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid())
    or auth.uid() is not null
  );
create policy "products: store owner actualiza" on products for update
  using (
    exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid())
  );

-- orders --
alter table orders enable row level security;
create policy "orders: cliente lee sus pedidos" on orders for select using (auth.uid() = customer_id);
create policy "orders: cliente inserta sus pedidos" on orders for insert with check (auth.uid() = customer_id);
create policy "orders: actualiza si es cliente o colaborador de la tienda" on orders for update
  using (
    auth.uid() = customer_id
    or exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'colaborador'
    )
  );

-- reviews --
alter table reviews enable row level security;
create policy "reviews: lectura publica" on reviews for select using (true);
create policy "reviews: autenticado inserta" on reviews for insert with check (auth.uid() is not null);

-- cart_items --
alter table cart_items enable row level security;
create policy "cart: solo owner" on cart_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- favorites --
alter table favorites enable row level security;
create policy "favorites: solo owner" on favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- followed_stores --
alter table followed_stores enable row level security;
create policy "followed_stores: solo owner" on followed_stores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- payment_cards --
alter table payment_cards enable row level security;
create policy "payment_cards: solo owner" on payment_cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- bank_accounts --
alter table bank_accounts enable row level security;
create policy "bank_accounts: solo owner" on bank_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: auto-crear perfil al registrar usuario en auth
-- (backup si el insert desde el cliente falla)
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, name, role, referral_balance)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'cliente'),
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
