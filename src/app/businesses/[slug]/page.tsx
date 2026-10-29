"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatStrip } from "@/components/ui/StatStrip";
import { CartPanel } from "@/components/faireats/CartPanel";
import { ItemConfigurator } from "@/components/faireats/ItemConfigurator";
import { cn } from "@/lib/cn";
import { cartItemCount, getCart, subscribeCart } from "@/lib/faireats/cart";
import { fetchStorefront, type Storefront } from "@/lib/faireats/client";
import { FAIREATS_CHAIN_NAME } from "@/lib/faireats/config";
import { cartSubtotalMicro, formatMicro } from "@/lib/faireats/pricing";
import type { CartLine, MenuItem } from "@/lib/faireats/types";

const CATEGORY_ORDER = ["main", "side", "drink"];

function categoryLabel(category: string): string {
  if (category === "main") return "Mains";
  if (category === "side") return "Sides";
  if (category === "drink") return "Drinks";
  return category;
}

export default function StorefrontPage() {
  const params = useParams<{ slug: string }>();
  const slug = (params?.slug ?? "").toLowerCase();

  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchStorefront(slug);
        if (!cancelled) setStorefront(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load this business");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

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

  const count = cartItemCount(lines);
  const subtotal = cartSubtotalMicro(lines);

  if (error) {
    return (
      <LayoutShell>
        <p className="label-text text-brand-red">■ FairEats</p>
        <div className="mt-4 border-2 border-brand-black bg-brand-red px-4 py-3 shadow-brutal">
          <p className="label-text text-white">// Could not load</p>
          <p className="mt-1 font-grotesk text-body text-white">{error}</p>
        </div>
        <Link
          href="/businesses"
          className="mt-4 inline-block font-mono text-xs font-bold uppercase tracking-wide text-brand-black underline"
        >
          ← All businesses
        </Link>
      </LayoutShell>
    );
  }

  if (!storefront) {
    return (
      <LayoutShell>
        <div className="h-6 w-40 animate-pulse bg-brand-cream" />
        <div className="mt-4 h-44 animate-pulse border-2 border-brand-black bg-brand-cream shadow-brutal" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse border-2 border-brand-black bg-brand-cream shadow-brutal"
            />
          ))}
        </div>
      </LayoutShell>
    );
  }

  const { merchant } = storefront;

  return (
    <LayoutShell>
      <div className="flex items-center justify-between gap-3">
        <p className="label-text text-brand-red">■ FairEats / {merchant.name}</p>
        <Link
          href="/businesses"
          className="font-mono text-[10px] font-bold uppercase tracking-wide text-brand-muted underline"
        >
          ← All businesses
        </Link>
      </div>

      {merchant.coverPath && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={merchant.coverPath}
          alt=""
          className="mt-3 h-36 w-full border-2 border-brand-black object-cover shadow-brutal sm:h-44"
        />
      )}

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
          { label: "Items", value: String(storefront.menu.length), sub: "on the menu" },
          {
            label: "In cart",
            value: String(count),
            sub: count > 0 ? `${formatMicro(subtotal)} USDC` : "nothing yet",
          },
        ]}
      />

      {grouped.map(({ category, items }) => (
        <section key={category} className="mt-8">
          <p className="label-text text-brand-black">{categoryLabel(category)}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <Card key={item.id} className="flex h-full flex-col p-0">
                {item.imagePath && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.imagePath}
                    alt=""
                    className="h-36 w-full border-b-2 border-brand-black object-cover"
                  />
                )}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-grotesk text-card-title font-bold uppercase text-brand-black">
                      {item.name}
                    </p>
                    <Badge variant="mono">
                      {formatMicro(item.basePriceMicro)}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="mt-2 font-grotesk text-body text-brand-ink">
                      {item.description}
                    </p>
                  )}
                  {item.groups.length > 0 && (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-brand-muted">
                      {item.groups.map((group) => group.name).join(" · ")}
                    </p>
                  )}
                  <div className="mt-4 flex-1" />
                  <Button
                    variant={item.isAvailable ? "yellow" : "white"}
                    size="md"
                    disabled={!item.isAvailable || !merchant.isOpen}
                    onClick={() => setConfiguring(item)}
                    className="w-full"
                  >
                    {item.isAvailable ? "Customise" : "Unavailable"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {/* Persistent cart bar. Sits above the mobile bottom nav. */}
      {count > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 md:bottom-6 md:left-56 md:px-8">
          <div
            className={cn(
              "mx-auto flex max-w-3xl items-center justify-between gap-3",
              "border-2 border-brand-black bg-brand-black px-4 py-3 shadow-brutal-lg",
            )}
          >
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
          onAdded={() => setCartOpen(true)}
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
