"use client";

import { useEffect } from "react";
import { useSignMessage } from "wagmi";

import { registerCloudSyncSigner } from "@/lib/cloud-sync";

/**
 * Registers the wagmi signer for cloud APIs (pull/push after explicit connect, profile save, etc.).
 * Cloud pull is NOT run automatically on page load — see WalletConnect / Topbar after connectAsync.
 */
export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    registerCloudSyncSigner((message) => signMessageAsync({ message }));
    return () => registerCloudSyncSigner(null);
  }, [signMessageAsync]);

  return <>{children}</>;
}
