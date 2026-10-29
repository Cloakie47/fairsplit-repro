-- Seeds the one simulated FairEats business: McFair.
--
-- Idempotent: if the 'mcfair' merchant already exists the whole block is a
-- no-op, so re-running the migration will not duplicate the menu or wipe live
-- orders. To reseed from scratch, delete the merchant row (cascades) and run
-- this file again.
--
-- Prices are micro-USDC (1 USDC = 1000000).
--
-- owner_address / payout_address are set to the project's deploy wallet, which
-- is also the FairsplitV2 fee recipient on Base Sepolia. Change them to point
-- the storefront at a different merchant wallet.

DO $$
DECLARE
  v_merchant uuid;
  v_item     uuid;
  v_group    uuid;
  v_now      bigint := (extract(epoch from now()) * 1000)::bigint;
  v_owner    text   := '0x1b343c206f13013f6247d92946456454493a46c8';
BEGIN
  IF EXISTS (SELECT 1 FROM public.faireats_merchants WHERE slug = 'mcfair') THEN
    RAISE NOTICE 'McFair already seeded; skipping.';
    RETURN;
  END IF;

  INSERT INTO public.faireats_merchants
    (slug, name, tagline, logo_path, cover_path, owner_address, payout_address,
     confidential_ready, is_open, created_at_ms)
  VALUES
    ('mcfair', 'McFair', 'Burgers, fries and cold cola. Pay in USDC.',
     '/faireats/mcfair/logo.svg', '/faireats/mcfair/cover.svg',
     v_owner, v_owner, false, true, v_now)
  RETURNING id INTO v_merchant;

  -- Tables ------------------------------------------------------------------
  INSERT INTO public.faireats_tables (merchant_id, table_code, seats, status)
  SELECT v_merchant, code, seats, 'available'
  FROM (VALUES
    ('T1', 2), ('T2', 2), ('T3', 4),
    ('T4', 4), ('T5', 6), ('T6', 6)
  ) AS t(code, seats);

  -- Burger ------------------------------------------------------------------
  INSERT INTO public.faireats_menu_items
    (merchant_id, name, description, category, base_price_usdc_micro, image_path, sort_order)
  VALUES
    (v_merchant, 'Burger', 'Flame-grilled patty, lettuce, tomato, house sauce.',
     'main', 6500000, '/faireats/mcfair/burger.svg', 1)
  RETURNING id INTO v_item;

  INSERT INTO public.faireats_option_groups
    (menu_item_id, name, kind, min_select, max_select, sort_order)
  VALUES (v_item, 'Size', 'single', 1, 1, 1)
  RETURNING id INTO v_group;

  INSERT INTO public.faireats_options
    (group_id, name, price_delta_usdc_micro, is_default, sort_order)
  SELECT v_group, name, delta, is_def, ord
  FROM (VALUES
    ('Single', 0::bigint, true, 1),
    ('Double', 2000000::bigint, false, 2),
    ('Triple', 4000000::bigint, false, 3)
  ) AS o(name, delta, is_def, ord);

  INSERT INTO public.faireats_option_groups
    (menu_item_id, name, kind, min_select, max_select, sort_order)
  VALUES (v_item, 'Add-ons', 'multi', 0, 4, 2)
  RETURNING id INTO v_group;

  INSERT INTO public.faireats_options
    (group_id, name, price_delta_usdc_micro, is_default, sort_order)
  SELECT v_group, name, delta, false, ord
  FROM (VALUES
    ('Extra cheese', 500000::bigint, 1),
    ('Bacon', 1200000::bigint, 2),
    ('Jalapenos', 400000::bigint, 3),
    ('No onions', 0::bigint, 4)
  ) AS o(name, delta, ord);

  -- Fries -------------------------------------------------------------------
  INSERT INTO public.faireats_menu_items
    (merchant_id, name, description, category, base_price_usdc_micro, image_path, sort_order)
  VALUES
    (v_merchant, 'Fries', 'Skin-on, salted, fried twice.',
     'side', 2500000, '/faireats/mcfair/fries.svg', 2)
  RETURNING id INTO v_item;

  INSERT INTO public.faireats_option_groups
    (menu_item_id, name, kind, min_select, max_select, sort_order)
  VALUES (v_item, 'Size', 'single', 1, 1, 1)
  RETURNING id INTO v_group;

  INSERT INTO public.faireats_options
    (group_id, name, price_delta_usdc_micro, is_default, sort_order)
  SELECT v_group, name, delta, is_def, ord
  FROM (VALUES
    ('Small', -500000::bigint, false, 1),
    ('Medium', 0::bigint, true, 2),
    ('Large', 1000000::bigint, false, 3)
  ) AS o(name, delta, is_def, ord);

  INSERT INTO public.faireats_option_groups
    (menu_item_id, name, kind, min_select, max_select, sort_order)
  VALUES (v_item, 'Add-ons', 'multi', 0, 2, 2)
  RETURNING id INTO v_group;

  INSERT INTO public.faireats_options
    (group_id, name, price_delta_usdc_micro, is_default, sort_order)
  SELECT v_group, name, delta, false, ord
  FROM (VALUES
    ('Cheese sauce', 800000::bigint, 1),
    ('Peri-peri salt', 300000::bigint, 2)
  ) AS o(name, delta, ord);

  -- Cola --------------------------------------------------------------------
  INSERT INTO public.faireats_menu_items
    (merchant_id, name, description, category, base_price_usdc_micro, image_path, sort_order)
  VALUES
    (v_merchant, 'Cola', 'Served cold, over ice.',
     'drink', 1800000, '/faireats/mcfair/cola.svg', 3)
  RETURNING id INTO v_item;

  INSERT INTO public.faireats_option_groups
    (menu_item_id, name, kind, min_select, max_select, sort_order)
  VALUES (v_item, 'Size', 'single', 1, 1, 1)
  RETURNING id INTO v_group;

  INSERT INTO public.faireats_options
    (group_id, name, price_delta_usdc_micro, is_default, sort_order)
  SELECT v_group, name, delta, is_def, ord
  FROM (VALUES
    ('Small', -300000::bigint, false, 1),
    ('Medium', 0::bigint, true, 2),
    ('Large', 700000::bigint, false, 3)
  ) AS o(name, delta, is_def, ord);

  INSERT INTO public.faireats_option_groups
    (menu_item_id, name, kind, min_select, max_select, sort_order)
  VALUES (v_item, 'Options', 'multi', 0, 1, 2)
  RETURNING id INTO v_group;

  INSERT INTO public.faireats_options
    (group_id, name, price_delta_usdc_micro, is_default, sort_order)
  VALUES (v_group, 'No ice', 0, false, 1);

  RAISE NOTICE 'McFair seeded: 6 tables, 3 menu items.';
END
$$;
