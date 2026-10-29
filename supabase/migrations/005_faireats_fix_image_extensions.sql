-- Correct McFair's stored image extensions to match the files that exist.
--
-- Not a content change: 004 assumed .jpg, the actual exports are .jpeg, and
-- the database should name the file that is really there. FoodImage tolerates
-- the mismatch (it tries jpg, jpeg, png, webp, then the placeholder SVG), but
-- relying on that means every page load fires a 404 first and logs an error.
--
-- Idempotent.

UPDATE public.faireats_menu_items
SET image_path = regexp_replace(image_path, '\.jpg$', '.jpeg')
WHERE image_path LIKE '/faireats/mcfair/%.jpg';

UPDATE public.faireats_merchants
SET cover_path = regexp_replace(cover_path, '\.jpg$', '.jpeg')
WHERE cover_path LIKE '/faireats/mcfair/%.jpg';
