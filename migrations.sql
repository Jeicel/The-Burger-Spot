-- Idempotent migrations for The Burger Spot
-- Run with: node scripts/migrate.js

-- USERS
CREATE TABLE IF NOT EXISTS public.users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'customer',
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);

-- MENU / PRODUCTS
CREATE TABLE IF NOT EXISTS public.menu_items (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  price_cents   INTEGER NOT NULL CHECK (price_cents >= 0),
  category      TEXT,
  image_url     TEXT,
  available     BOOLEAN NOT NULL DEFAULT true,
  options       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items (category);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items (available);
CREATE INDEX IF NOT EXISTS idx_menu_items_options_gin ON public.menu_items USING GIN (options);

-- ORDERS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('pending','confirmed','preparing','out_for_delivery','completed','cancelled');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.orders (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  email             TEXT,
  phone             TEXT,
  address_id        BIGINT,
  subtotal_cents    INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents    INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  tax_cents         INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents       INTEGER NOT NULL CHECK (total_cents >= 0),
  status            public.order_status NOT NULL DEFAULT 'pending',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id         BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id     BIGINT REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name        TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  options          JSONB NOT NULL DEFAULT '{}'::jsonb,
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  method        TEXT NOT NULL,
  status        TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents >= 0),
  details       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sample seed data (DEV ONLY) -- uncomment to insert locally if desired
-- INSERT INTO public.menu_items (name, slug, description, price_cents, category, image_url, options)
-- VALUES ('Classic Burger','classic-burger','Beef patty, lettuce, tomato',12900,'burger','/images/classic-burger.jpg','{"extras":["cheese","bacon"]}');
