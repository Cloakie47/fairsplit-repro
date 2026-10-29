"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

interface FoodImageProps {
  src?: string;
  alt: string;
  className?: string;
  /**
   * Tailwind aspect ratio class. Fixed so varied photo dimensions cannot break
   * the grid — every card reserves the same box and object-cover fills it.
   */
  aspect?: string;
  /**
   * CSS object-position. Useful when the source is portrait and the box is
   * wide: a centred crop of a tall photo is mostly background.
   */
  objectPosition?: string;
}

/** Raster extensions tried before giving up on the placeholder SVG. */
const RASTER_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

/**
 * Candidate URLs for one image, in order.
 *
 * Only local FairEats assets get extension rewriting: a merchant-uploaded
 * remote URL (storage bucket, CDN) is used exactly as given, because swapping
 * its extension would fabricate a URL that never existed.
 *
 * For local paths the stored extension is tried first, then the other raster
 * formats, then the placeholder SVG. This exists because "what the database
 * says" and "what the designer actually exported" routinely disagree — .jpeg
 * versus .jpg being the classic case.
 */
export function imageCandidates(src?: string): string[] {
  if (!src) return [];
  if (!src.startsWith("/faireats/")) return [src];

  const stem = src.replace(/\.(jpe?g|png|webp|avif|svg)$/i, "");
  const stored = src.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();

  const order = [...(stored ? [stored] : []), ...RASTER_EXTENSIONS, "svg"];

  return Array.from(new Set(order.map((ext) => `${stem}.${ext}`)));
}

export function FoodImage({
  src,
  alt,
  className,
  aspect = "aspect-[4/3]",
  objectPosition = "center",
}: FoodImageProps) {
  const candidates = imageCandidates(src);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [src]);

  const current = candidates[index];
  const exhausted = index >= candidates.length;

  return (
    <div
      className={cn(
        aspect,
        "w-full overflow-hidden border-b-2 border-brand-black bg-brand-cream",
        className,
      )}
    >
      {current && !exhausted && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={current}
          src={current}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          style={{ objectPosition }}
          onError={() => {
            const next = index + 1;
            // Say so rather than failing silently: a fallback means the stored
            // path is wrong, and that should be fixable rather than invisible.
            if (candidates[next]) {
              console.warn(
                `[faireats] image not found: ${current} — trying ${candidates[next]}`,
              );
            } else {
              console.warn(`[faireats] no image found for ${src}`);
            }
            setIndex(next);
          }}
        />
      )}
    </div>
  );
}
