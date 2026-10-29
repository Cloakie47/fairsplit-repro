"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { LayoutShell } from "@/components/LayoutShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatStrip } from "@/components/ui/StatStrip";
import { CartDock, CartPanel } from "@/components/faireats/CartPanel";
import { FoodImage } from "@/components/faireats/FoodImage";
import { ItemConfigurator } from "@/components/faireats/ItemConfigurator";
import { MenuCard } from "@/components/faireats/MenuCard";
import { cn } from "@/lib/cn";
import {
  addToCart,
  cartItemCount,
  defaultSelectionsFor,
  getCart,
  subscribeCart,
} from "@/lib/faireats/cart";
import { fetchStorefront, type Storefront } from "@/lib/faireats/client";
import { FAIREATS_CHAIN_NAME } from "@/lib/faireats/config";
import { cartSubtotalMicro, formatMicro } from "@/lib/faireats/pricing";
import type { CartLine, MenuItem } from "@/lib/faireats/types";

const CATEGORY_ORDER = ["main", "side", "drink"];

/**
 * Below this many items the menu renders as ONE grid with no per-category
 * section headers. A header above a single card is noise, and three
 * one-item sections stacked vertically wastes the whole page. The rail still
 * works: it scroll-spies against the first item of each category instead of
 * against section elements.
 */
const SINGLE_GRID_MAX_ITEMS = 8;

/**
 * Cards are never allowed below 300px. Column count therefore falls out of
 * the available width and the number of items rather than being pinned to a
 * breakpoint, so a three-item menu shows three real cards instead of three
 * slivers. min(100%, 300px) keeps it from overflowing a narrow phone.
 */
const GRID_COLUMNS = "repeat(auto-fit, minmax(min(100%, 300px), 1fr))";

/**
 * Caps how wide cards grow when there are only a handful of them.
 *
 * The max track has to be 1fr, not a fixed 360px: `auto-fit` derives the
 * number of repetitions from the track's *max* when that max is a definite
 * length, so minmax(300px, 360px) packed by 360 and produced two columns in
 * 1016px of space instead of three. Using 1fr makes it pack by the 300px
 * floor, and this max-width stops three items spreading to 500px each on a
 * wide screen.
 */
const GRID_MAX_WIDTH = 1140;

const CATEGORY_LABELS: Record<string, string> = {
  main: "Mains",
  side: "Sides",
  drink: "Drinks",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export default function StorefrontPage() {
  const params = useParams<{ slug: string }>();
  const slug = (params?.slug ?? "").toLowerCase();

  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ attempt: number; attempts: number } | null>(null);
  const [configuring, setConfiguring] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchStorefront(slug, {
        onProgress: ({ attempt, attempts }) => setConnecting({ attempt, attempts }),
      });
      setStorefront(data);
      setConnecting(null);
    } catch (e) {
      setConnecting(null);
      setError(e instanceof Error ? e.message : "Could not load this business");
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    void load();
  }, [slug, load]);

  useEffect(() => {
    if (!slug) return;
    const read = () => setLines(getCart(slug));
    read();
    return subscribeCart(read);
  }, [slug]);

  const grouped = useMemo(() => {
    const menu = storefront?.menu ?? [];
    const categories = Array.from(new Set(menu.map((item) => item.category)));
    categories.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return categories.map((category) => ({
      category,
      items: menu.filter((item) => item.category === category),
    }));
  }, [storefront]);

  const flatItems = useMemo(
    () => grouped.flatMap(({ items }) => items),
    [grouped],
  );

  const singleGrid = flatItems.length <= SINGLE_GRID_MAX_ITEMS;

  /** First item of each category, so the rail can spy without section headers. */
  const anchorIds = useMemo(() => {
    const map: Record<string, string> = {};
    for (const { category, items } of grouped) {
      if (items[0]) map[items[0].id] = category;
    }
    return map;
  }, [grouped]);

  // Scroll-spy for the category rail. rootMargin biases the trigger towards
  // the upper third so a section counts as active once its heading is near the
  // top rather than when it happens to cross the middle.
  useEffect(() => {
    if (grouped.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target instanceof HTMLElement) {
          const category = visible[0].target.dataset.category;
          if (category) setActiveCategory(category);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );
    for (const { category } of grouped) {
      const el = sectionRefs.current[category];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [grouped]);

  const jumpTo = (category: string) => {
    setActiveCategory(category);
    sectionRefs.current[category]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  /** Items with option groups open the configurator; the rest add in one tap. */
  const onAdd = (item: MenuItem) => {
    if (item.groups.length > 0) {
      setConfiguring(item);
      return;
    }
    addToCart(slug, {
      menuItemId: item.id,
      name: item.name,
      imagePath: item.imagePath,
      basePriceMicro: item.basePriceMicro,
      selected: defaultSelectionsFor(item),
      quantity: 1,
    });
  };

  const count = cartItemCount(lines);
  const subtotal = cartSubtotalMicro(lines);

  if (error) {
    return (
      <LayoutShell>
        <p className="label-text text-brand-red">■ FairEats</p>
        <div className="mt-4 border-2 border-brand-black bg-brand-cream px-5 py-4 shadow-brutal">
          <p className="label-text text-brand-red">// Could not load</p>
          <p className="mt-2 font-grotesk text-body text-brand-ink">{error}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="yellow" size="md" onClick={() => void load()}>
              Try again
            </Button>
            <Link href="/businesses">
              <Button variant="white" size="md">
                All businesses
              </Button>
            </Link>
          </div>
        </div>
      </LayoutShell>
    );
  }

  if (!storefront) {
    return (
      <LayoutShell wide>
        <p className="label-text text-brand-red">■ FairEats</p>
        {connecting && (
          <div className="mt-4 inline-flex items-center gap-2 border-2 border-brand-black bg-brand-yellow px-4 py-2 shadow-brutal">
            <span className="inline-block h-2.5 w-2.5 animate-pulse bg-brand-black" />
            <p className="font-grotesk text-xs font-bold uppercase tracking-wide text-brand-black">
              Connecting… attempt {connecting.attempt + 1} of {connecting.attempts}
            </p>
          </div>
        )}
        <div className="mt-4 h-36 animate-pulse border-2 border-brand-black bg-brand-cream shadow-brutal sm:h-44" />
        <div
          className="mt-6 grid gap-4"
          style={{ gridTemplateColumns: GRID_COLUMNS, maxWidth: GRID_MAX_WIDTH }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-80 animate-pulse border-2 border-brand-black bg-brand-cream shadow-brutal"
            />
          ))}
        </div>
      </LayoutShell>
    );
  }

  const { merchant } = storefront;

  return (
    <LayoutShell wide>
      <div className="flex items-center justify-between gap-3">
        <p className="label-text text-brand-red">■ FairEats / {merchant.name}</p>
        <Link
          href="/businesses"
          className="font-mono text-[10px] font-bold uppercase tracking-wide text-brand-muted underline"
        >
          ← All businesses
        </Link>
      </div>

      <div className="mt-3 border-2 border-brand-black shadow-brutal">
        <FoodImage
          src={merchant.coverPath}
          alt=""
          aspect="aspect-[16/7]"
          // McFair's cover is portrait (736x1102); a centred crop of it is
          // mostly background wall, so bias downward onto the subject.
          objectPosition="center 62%"
          className="border-b-0"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-grotesk text-page-title font-bold uppercase text-brand-black">
            {merchant.name}
          </h1>
          {merchant.tagline && (
            <p className="mt-1 font-grotesk text-body text-brand-muted">
              {merchant.tagline}
            </p>
          )}
        </div>
        <Badge variant={merchant.isOpen ? "green" : "red"}>
          {merchant.isOpen ? "Open now" : "Closed"}
        </Badge>
      </div>

      <StatStrip
        className="mt-5"
        items={[
          { label: "Pay in", value: "USDC", sub: FAIREATS_CHAIN_NAME },
          {
            label: "Items",
            value: String(storefront.menu.length),
            sub: "on the menu",
          },
          {
            label: "In cart",
            value: String(count),
            sub: count > 0 ? `${formatMicro(subtotal)} USDC` : "nothing yet",
          },
        ]}
      />

      <div className="mt-6 flex gap-5">
        {/* Category rail — left and sticky for a large menu. A small menu
            renders it horizontally above the grid instead (see below): at
            laptop widths the 148px rail is the difference between three cards
            per row and two, and a vertical list of one-item categories earns
            none of that space. */}
        {!singleGrid && (
          <aside className="hidden w-[148px] shrink-0 lg:block">
            <div className="sticky top-6 border-2 border-brand-black bg-white shadow-brutal">
              <p className="label-text border-b-2 border-brand-black bg-brand-cream px-3 py-2 text-brand-muted">
                Menu
              </p>
              <nav className="flex flex-col p-2">
                {grouped.map(({ category, items }) => {
                  const isActive = activeCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => jumpTo(category)}
                      className={cn(
                        "mb-1 flex items-center justify-between gap-2 border-2 px-2.5 py-2 text-left",
                        "font-grotesk text-xs font-bold uppercase transition-all duration-75",
                        isActive
                          ? "border-brand-black bg-brand-black text-brand-yellow"
                          : "border-transparent text-brand-ink hover:border-brand-black hover:bg-brand-yellow",
                      )}
                    >
                      <span>{categoryLabel(category)}</span>
                      <span className="font-mono text-[10px] opacity-70">
                        {items.length}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>
        )}

        {/* Menu grid */}
        <div className="min-w-0 flex-1">
          {singleGrid && grouped.length > 1 && (
            <nav className="mb-4 flex flex-wrap gap-2">
              {grouped.map(({ category, items }) => {
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => jumpTo(category)}
                    className={cn(
                      "flex items-center gap-2 border-2 border-brand-black px-3 py-1.5",
                      "font-grotesk text-xs font-bold uppercase transition-all duration-75",
                      isActive
                        ? "bg-brand-black text-brand-yellow shadow-brutal"
                        : "bg-white text-brand-ink hover:bg-brand-yellow",
                    )}
                  >
                    <span>{categoryLabel(category)}</span>
                    <span className="font-mono text-[10px] opacity-70">
                      {items.length}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
          {singleGrid ? (
            <div
              data-menu-grid
              className="grid gap-4"
              style={{
                gridTemplateColumns: GRID_COLUMNS,
                maxWidth: GRID_MAX_WIDTH,
              }}
            >
              {flatItems.map((item) => (
                <div
                  key={item.id}
                  ref={(el) => {
                    if (anchorIds[item.id]) {
                      sectionRefs.current[anchorIds[item.id]] = el;
                    }
                  }}
                  data-category={anchorIds[item.id] ?? undefined}
                  className="scroll-mt-24"
                >
                  <MenuCard
                    item={item}
                    disabled={!merchant.isOpen}
                    onAdd={onAdd}
                  />
                </div>
              ))}
            </div>
          ) : (
            grouped.map(({ category, items }) => (
              <section
                key={category}
                data-category={category}
                ref={(el) => {
                  sectionRefs.current[category] = el;
                }}
                className="mb-8 scroll-mt-24"
              >
                <p className="label-text mb-3 text-brand-black">
                  {categoryLabel(category)}
                </p>
                <div
                  data-menu-grid
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: GRID_COLUMNS,
                    maxWidth: GRID_MAX_WIDTH,
                  }}
                >
                  {items.map((item) => (
                    <MenuCard
                      key={item.id}
                      item={item}
                      disabled={!merchant.isOpen}
                      onAdd={onAdd}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        {/* Docked cart — desktop only; mobile uses the slide-over. */}
        <aside className="hidden w-[300px] shrink-0 2xl:block">
          <CartDock merchantSlug={slug} />
        </aside>
      </div>

      {/* Mobile cart bar. Sits above the mobile bottom nav. */}
      {count > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 2xl:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 border-2 border-brand-black bg-brand-black px-4 py-3 shadow-brutal-lg">
            <div>
              <p className="label-text text-brand-yellow">
                {count} {count === 1 ? "item" : "items"}
              </p>
              <p className="font-grotesk text-body font-bold text-white">
                {formatMicro(subtotal)} USDC
              </p>
            </div>
            <Button variant="yellow" size="md" onClick={() => setCartOpen(true)}>
              View cart
            </Button>
          </div>
        </div>
      )}

      {configuring && (
        <ItemConfigurator
          merchantSlug={slug}
          item={configuring}
          onClose={() => setConfiguring(null)}
          onAdded={() => {
            // The dock is only present at 2xl; narrower viewports use the
            // slide-over, so it needs opening there.
            if (window.innerWidth < 1536) setCartOpen(true);
          }}
        />
      )}

      <CartPanel
        merchantSlug={slug}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
      />
    </LayoutShell>
  );
}
