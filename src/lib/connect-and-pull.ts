"use client";

import { getAccount } from "wagmi/actions";
import type { Config } from "wagmi";

import { isCloudSyncConfigured, pullFromCloud } from "@/lib/cloud-sync";

/**
 * After a successful wallet connect, restore data from Supabase (wallet signature).
 */
export async function pullCloudDataAfterConnect(config: Config): Promise<void> {
  if (!isCloudSyncConfigured()) return;
  const { address } = getAccount(config);
  if (!address) return;
  await pullFromCloud(address);
}
