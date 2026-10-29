"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

interface FoodImageProps {
  src?: string;
  alt: string;
  className?: string;
  /** Tailwind aspect ratio class. Fixed so varied photo dimensions cannot
   *  break the grid — every card reserves the same box. */
  aspect?: string;
}

function svgFallbackFor(src?: string): string | undefined {
  if (!src) return undefined;
  const swapped = src.replace(/\.(jpe?g|png|webp|avif)$/i, ".svg");
  return swapped === src ? undefined : swapped;
}

/**
 * Menu and cover imagery.
 *
 * `image_path` points at a raster photo; if that file is absent the component
 * falls back to the placeholder SVG of the same basename, so a merchant can
 * drop real photos in (or not) without the grid breaking or 404ing visibly.
 * `object-fit: cover` inside a fixed aspect box keeps every card the same
 * height regardless of the photo's own dimensions.
 */
export function FoodImage({
  src,
  alt,
  className,
  aspect = "aspect-[4/3]",
}: FoodImageProps) {
  const [current, setCurrent] = useState(src);

  useEffect(() => {
    setCurrent(src);
  }, [src]);

  return (
    <div
      className={cn(
        aspect,
        "w-full overflow-hidden border-b-2 border-brand-black bg-brand-bg",
        className,
      )}
    >
      {current && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={current}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => {
            const fallback = svgFallbackFor(src);
            if (fallback && current !== fallback) setCurrent(fallback);
          }}
        />
      )}
    </div>
  );
}
