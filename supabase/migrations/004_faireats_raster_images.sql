-- Point McFair's imagery at raster photos.
--
-- The storefront renders image_path and falls back to the placeholder SVG of
-- the same basename if the raster file is missing (see FoodImage), so this is
-- safe to apply before the photos are actually dropped into
-- public/faireats/mcfair/ -- the cards keep showing the SVGs until they are.
--
-- Idempotent: only rewrites paths that still end in .svg.

UPDATE public.faireats_menu_items
SET image_path = regexp_replace(image_path, '\.svg$', '.jpg')
WHERE image_path LIKE '/faireats/mcfair/%.svg';

UPDATE public.faireats_merchants
SET cover_path = regexp_replace(cover_path, '\.svg$', '.jpg')
WHERE cover_path LIKE '/faireats/mcfair/%.svg';

-- logo_path deliberately stays as SVG: the brand mark is line art, not a photo.
