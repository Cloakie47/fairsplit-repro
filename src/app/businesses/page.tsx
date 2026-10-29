"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { fetchMerchants } from "@/lib/faireats/client";
import { FAIREATS_CHAIN_NAME } from "@/lib/faireats/config";
import type { Merchant } from "@/lib/faireats/types";

export default function BusinessesPage() {
  const [merchants, setMerchants] = useState<Merchant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{
    attempt: number;
    attempts: number;
  } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchMerchants({
        onProgress: ({ attempt, attempts }) =>
          setConnecting({ attempt, attempts }),
      });
      setMerchants(list);
      setConnecting(null);
    } catch (e) {
      setConnecting(null);
      setError(e instanceof Error ? e.message : "Could not load businesses");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <LayoutShell>
      <p className="label-text text-brand-red">■ FairEats / Businesses</p>
      <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black">
        Businesses
      </h1>
      <p className="mt-2 max-w-xl font-grotesk text-body text-brand-muted">
        Order and pay in USDC on {FAIREATS_CHAIN_NAME}. No card, no terminal.
        Split the bill at checkout or settle it on your own.
      </p>

      {error && (
        <div className="mt-6 border-2 border-brand-black bg-brand-cream px-5 py-4 shadow-brutal">
          <p className="label-text text-brand-red">// Could not load</p>
          <p className="mt-2 font-grotesk text-body text-brand-ink">{error}</p>
          <Button
            variant="yellow"
            size="md"
            className="mt-4"
            onClick={() => void load()}
          >
            Try again
          </Button>
        </div>
      )}

      {connecting && !merchants && (
        <div className="mt-6 inline-flex items-center gap-2 border-2 border-brand-black bg-brand-yellow px-4 py-2 shadow-brutal">
          <span className="inline-block h-2.5 w-2.5 animate-pulse bg-brand-black" />
          <p className="font-grotesk text-xs font-bold uppercase tracking-wide text-brand-black">
            Connecting… attempt {connecting.attempt + 1} of {connecting.attempts}
          </p>
        </div>
      )}

      {!merchants && !error && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse border-2 border-brand-black bg-brand-cream shadow-brutal"
            />
          ))}
        </div>
      )}

      {merchants && merchants.length === 0 && !error && (
        <Card hoverable={false} className="mt-6 p-6">
          <p className="label-text text-brand-muted">// Empty</p>
          <p className="mt-2 font-grotesk text-body text-brand-ink">
            No businesses are listed yet.
          </p>
        </Card>
      )}

      {merchants && merchants.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {merchants.map((merchant) => (
            <Link
              key={merchant.id}
              href={`/businesses/${merchant.slug}`}
              className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black"
            >
              <Card className="h-full p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {merchant.logoPath && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={merchant.logoPath}
                        alt=""
                        className="h-12 w-12 border-2 border-brand-black"
                      />
                    )}
                    <div>
                      <p className="font-grotesk text-card-title font-bold uppercase text-brand-black">
                        {merchant.name}
                      </p>
                      <p className="font-mono text-xs text-brand-muted">
                        /{merchant.slug}
                      </p>
                    </div>
                  </div>
                  <Badge variant={merchant.isOpen ? "green" : "red"}>
                    {merchant.isOpen ? "Open" : "Closed"}
                  </Badge>
                </div>

                {merchant.tagline && (
                  <p className="mt-4 font-grotesk text-body text-brand-ink">
                    {merchant.tagline}
                  </p>
                )}

                <p className="mt-4 label-text text-brand-muted">
                  USDC · {FAIREATS_CHAIN_NAME}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </LayoutShell>
  );
}
