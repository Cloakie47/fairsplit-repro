"use client";

import { resolveDisplayName } from "@/lib/friends";

type FriendNameProps = {
  viewerAddress?: string | null;
  address: string;
  className?: string;
};

export function FriendName({ viewerAddress, address, className }: FriendNameProps) {
  const label = resolveDisplayName(viewerAddress, address);
  return <span className={className}>{label}</span>;
}

