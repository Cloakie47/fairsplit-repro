-- FairEats: merchant storefront, tables, menu, orders, splits.
--
-- Everything here is OFFCHAIN. The only onchain artefact of a FairEats order is
-- the USDC settlement (FairsplitV2.directPay / createSplit, or a Fairblock
-- confidential transfer). No personal identifier is ever written onchain:
-- merchant names, table codes, item names, order ids and display names live
-- only in these tables.
--
-- Money convention: every *_micro column is an integer count of micro-USDC
-- (1 USDC = 1000000), matching USDC's 6 decimals and the raw units passed to
-- the contract. Integers only, so summing shares never drifts.
-- (001_initial_schema.sql stores amounts as text; new tables use exact integers.)
--
-- Chain scope: FairEats targets Base only, built and tested on Base Sepolia
-- (84532). chain_id is stored per order so moving to Base mainnet (8453) needs
-- no schema change.
--
-- Run in Supabase Dashboard -> SQL Editor, or `supabase db push`.

-- ---------------------------------------------------------------------------
-- Merchants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.faireats_merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug = lower(slug)),
  name text NOT NULL,
  tagline text,
  logo_path text,
  cover_path text,
  -- Wallet that administers the storefront (release tables, see live orders).
  owner_address text NOT NULL CHECK (owner_address = lower(owner_address)),
  -- Wallet that receives USDC. Usually the same as owner_address.
  payout_address text NOT NULL CHECK (payout_address = lower(payout_address)),
  -- Mirrors Fairblock account readiness so checkout can gate the "hide amount"
  -- option without an onchain round trip. Refreshed by the app and never
  -- trusted as authoritative: the payment wrapper re-checks the recipient
  -- before transferring.
  confidential_ready boolean NOT NULL DEFAULT false,
  is_open boolean NOT NULL DEFAULT true,
  created_at_ms bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS faireats_merchants_owner_idx
  ON public.faireats_merchants (owner_address);

-- ---------------------------------------------------------------------------
-- Tables (the physical kind)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.faireats_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.faireats_merchants (id) ON DELETE CASCADE,
  table_code text NOT NULL,
  seats int,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'occupied')),
  -- Set together with status='occupied'; cleared on release.
  occupant_address text CHECK (occupant_address = lower(occupant_address)),
  locked_at_ms bigint,
  UNIQUE (merchant_id, table_code),
  -- An occupied table always has an occupant and a lock time; an available one
  -- has neither. Enforced here so a half-released table cannot exist.
  CONSTRAINT faireats_tables_occupancy_consistent CHECK (
    (status = 'occupied' AND occupant_address IS NOT NULL AND locked_at_ms IS NOT NULL)
    OR
    (status = 'available' AND occupant_address IS NULL AND locked_at_ms IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS faireats_tables_merchant_idx
  ON public.faireats_tables (merchant_id, status);
CREATE INDEX IF NOT EXISTS faireats_tables_occupant_idx
  ON public.faireats_tables (occupant_address);

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.faireats_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.faireats_merchants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'main',
  base_price_usdc_micro bigint NOT NULL CHECK (base_price_usdc_micro > 0),
  image_path text,
  is_available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS faireats_menu_items_merchant_idx
  ON public.faireats_menu_items (merchant_id, category, sort_order);

-- A group of choices on an item: "Size" (pick one), "Add-ons" (pick many).
CREATE TABLE IF NOT EXISTS public.faireats_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.faireats_menu_items (id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('single', 'multi')),
  min_select int NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select int CHECK (max_select IS NULL OR max_select >= 1),
  sort_order int NOT NULL DEFAULT 0,
  CONSTRAINT faireats_option_groups_bounds CHECK (
    max_select IS NULL OR max_select >= min_select
  )
);

CREATE INDEX IF NOT EXISTS faireats_option_groups_item_idx
  ON public.faireats_option_groups (menu_item_id, sort_order);

-- price_delta may be negative (e.g. "Small" below the base price).
CREATE TABLE IF NOT EXISTS public.faireats_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.faireats_option_groups (id) ON DELETE CASCADE,
  name text NOT NULL,
  price_delta_usdc_micro bigint NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS faireats_options_group_idx
  ON public.faireats_options (group_id, sort_order);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.faireats_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.faireats_merchants (id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.faireats_tables (id) ON DELETE SET NULL,
  -- Denormalised so a released or renamed table still shows on the receipt.
  table_code_snapshot text,
  payer_address text NOT NULL CHECK (payer_address = lower(payer_address)),
  subtotal_usdc_micro bigint NOT NULL CHECK (subtotal_usdc_micro >= 0),
  total_usdc_micro bigint NOT NULL CHECK (total_usdc_micro >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',            -- cart, not submitted
    'awaiting_payment', -- submitted, settlement not confirmed
    'paid',             -- payer settled with the merchant
    'splitting',        -- split created, participants still owe the payer
    'settled',          -- everyone has paid
    'cancelled'
  )),
  payment_mode text NOT NULL DEFAULT 'public'
    CHECK (payment_mode IN ('public', 'confidential')),
  -- 'alone' can still be split afterwards; see split_id.
  split_mode text NOT NULL DEFAULT 'alone'
    CHECK (split_mode IN ('alone', 'participants')),
  chain_id bigint NOT NULL,
  -- FairsplitV2 splitId, when this order was split. The only link between an
  -- order and anything onchain. It maps a public split to private order data,
  -- so it is stored here and never exposed publicly.
  split_id text,
  -- Settlement tx for the payer's own payment (directPay or confidential).
  tx_hash text,
  created_at_ms bigint NOT NULL,
  paid_at_ms bigint,
  settled_at_ms bigint,
  -- A confidential payment hides the amount onchain, so it cannot be verified
  -- from the chain alone; require the tx hash once it has been settled.
  CONSTRAINT faireats_orders_confidential_has_tx CHECK (
    payment_mode <> 'confidential'
    OR status IN ('draft', 'awaiting_payment', 'cancelled')
    OR tx_hash IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS faireats_orders_merchant_idx
  ON public.faireats_orders (merchant_id, status, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS faireats_orders_payer_idx
  ON public.faireats_orders (payer_address, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS faireats_orders_split_idx
  ON public.faireats_orders (chain_id, split_id);

-- Line items snapshot name and price at order time so later menu edits do not
-- rewrite history.
CREATE TABLE IF NOT EXISTS public.faireats_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.faireats_orders (id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.faireats_menu_items (id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  unit_price_usdc_micro bigint NOT NULL CHECK (unit_price_usdc_micro >= 0),
  quantity int NOT NULL CHECK (quantity > 0),
  line_total_usdc_micro bigint NOT NULL CHECK (line_total_usdc_micro >= 0),
  -- [{ group, option, price_delta_usdc_micro }] as chosen, for the receipt and
  -- the kitchen ticket.
  options_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS faireats_order_items_order_idx
  ON public.faireats_order_items (order_id, sort_order);

-- Per-participant shares. This is what lets a participant see their own share
-- even when the payment was confidential: shares live here, not onchain.
CREATE TABLE IF NOT EXISTS public.faireats_order_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.faireats_orders (id) ON DELETE CASCADE,
  participant_address text NOT NULL CHECK (participant_address = lower(participant_address)),
  share_usdc_micro bigint NOT NULL CHECK (share_usdc_micro > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid')),
  paid_at_ms bigint,
  UNIQUE (order_id, participant_address)
);

CREATE INDEX IF NOT EXISTS faireats_order_participants_participant_idx
  ON public.faireats_order_participants (participant_address, status);

-- ---------------------------------------------------------------------------
-- Row Level Security: on, with no policies -- same posture as 001.
-- Only the service role (server-side API routes, after wallet-signature
-- verification via verifyWalletSessionOrAuth) may read or write these tables.
-- The browser anon client must never touch them. See issue #2 for the existing
-- drift this deliberately does not inherit.
-- ---------------------------------------------------------------------------
ALTER TABLE public.faireats_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faireats_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faireats_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faireats_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faireats_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faireats_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faireats_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faireats_order_participants ENABLE ROW LEVEL SECURITY;
