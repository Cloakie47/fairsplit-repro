import { ethers } from "ethers";
import type { WalletClient } from "viem";

export async function walletClientToSigner(
  walletClient: WalletClient
): Promise<ethers.Signer> {
  if (!walletClient.account) {
    throw new Error("Wallet account is not available. Reconnect wallet and try again.");
  }
  const eip1193Provider: ethers.Eip1193Provider = {
    request: (args: { method: string; params?: unknown[] | object }) =>
      walletClient.request(args as never),
  };
  const provider = new ethers.BrowserProvider(eip1193Provider);
  return provider.getSigner(walletClient.account.address);
}

