"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { useWalletClient } from "wagmi";
import { LayoutShell } from "@/components/LayoutShell";
import { getContract, parseBillId } from "@/lib/contract";
import {
  CONTRACT_ADDRESSES,
  getDefaultTokenForChain,
  getTokensForChain,
  isBillSplitterConfigured,
  SUPPORTED_CHAINS,
} from "@/lib/chains";
import { useChainTheme, CHAIN_ACCENT } from "@/lib/theme";
import { logActivity } from "@/lib/activity";
import { createSplitRequests } from "@/lib/requests";
import { walletClientToSigner } from "@/lib/wallet";
import { getFriendByAddress, getFriendEmail } from "@/lib/friends";
import { getProfile } from "@/lib/profile";
import { addNotification } from "@/lib/notifications";
import { showSuccessToast } from "@/lib/toast";
import { parseParticipantInputs, resolveInputToAddress } from "@/lib/nameService";
import { ethers } from "ethers";

export default function CreateBillPage() {
  const router = useRouter();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const theme = useChainTheme();
  const accent = CHAIN_ACCENT[theme];
  const isTempo = chainId === SUPPORTED_CHAINS.tempoTestnet.id;
  const availableTokens = useMemo(() => getTokensForChain(chainId), [chainId]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customReminder, setCustomReminder] = useState("");
  const [participantsStr, setParticipantsStr] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [selectedTokenAddress, setSelectedTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedToken =
    availableTokens.find((token) => token.address === selectedTokenAddress) ??
    getDefaultTokenForChain(chainId);
  const tokenSymbol = selectedToken?.symbol ?? "USDC";
  const contractDeployed = isBillSplitterConfigured(chainId);

  useEffect(() => {
    const fallback = getDefaultTokenForChain(chainId);
    if (!fallback) {
      setSelectedTokenAddress("");
      return;
    }
    const exists = availableTokens.some((token) => token.address === selectedTokenAddress);
    if (!selectedTokenAddress || !exists) {
      setSelectedTokenAddress(fallback.address);
    }
  }, [availableTokens, chainId, selectedTokenAddress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletClient || !address || !chainId || !selectedToken) return;
    const tokenAddress = selectedToken.address;
    if (!tokenAddress) {
      setError(
        isTempo
          ? "Tempo multi-token split creation is being integrated. Switch to Base or Arc for live split creation."
          : "Unsupported chain. Switch to Base or Arc."
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const signer = await walletClientToSigner(walletClient);
      const contract = getContract(signer, chainId);
      const billId = parseBillId(name.trim() || `bill-${Date.now()}`);
      const participantInputs = parseParticipantInputs(participantsStr);
      const amountRaw = ethers.parseUnits(amountStr, 6);

      if (!name.trim()) {
        setError("Name is required.");
        return;
      }
      if (participantInputs.length === 0) {
        setError("Add at least one participant address or name.");
        return;
      }

      const resolvedParticipants = await Promise.all(
        participantInputs.map(async (input) => ({
          input,
          address: await resolveInputToAddress(input, chainId),
        }))
      );
      const participants = Array.from(
        new Map(
          resolvedParticipants.map((entry) => [entry.address.toLowerCase(), entry.address])
        ).values()
      );

      const tx = await contract.createBill(
        billId,
        name.trim(),
        description.trim(),
        customReminder.trim(),
        tokenAddress,
        participants,
        amountRaw
      );
      await tx.wait();
      createSplitRequests({
        chainId,
        billId,
        splitName: name.trim(),
        creatorAddress: address,
        participants,
        amountUsdc: ethers.formatUnits(amountRaw, 6),
        tokenAddress,
        tokenSymbol,
        customReminder: customReminder.trim(),
      });

      const creatorProfile = getProfile(address);
      const recipients: Array<{
        email: string;
        walletAddress: string;
        displayName?: string;
      }> = [];
      for (const participantRaw of participants) {
        const participant = participantRaw.toLowerCase();
        if (participant === address.toLowerCase()) continue;
        const friendEmail = getFriendEmail(address, participant);
        const participantProfile = getProfile(participant);
        const profileEmail = participantProfile?.emailRemindersOptIn
          ? participantProfile.email
          : undefined;
        const email = friendEmail || profileEmail;
        if (!email) continue;
        const friend = getFriendByAddress(address, participant);
        recipients.push({
          email,
          walletAddress: participant,
          displayName: friend?.nickname || participantProfile?.displayName,
        });
      }

      if (recipients.length > 0) {
        const emailRes = await fetch("/api/email/split-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            splitName: name.trim(),
            creatorAddress: address,
            creatorDisplayName: creatorProfile?.displayName,
            amountUsdc: ethers.formatUnits(amountRaw, 6),
            tokenAddress,
            tokenSymbol,
            customReminder: customReminder.trim(),
            appUrl: window.location.origin,
            recipients,
          }),
        });
        const emailJson = (await emailRes.json()) as {
          ok: boolean;
          sent?: number;
          failed?: number;
          error?: string;
        };
        if (!emailRes.ok || !emailJson.ok) {
          addNotification(address, {
            type: "reminder",
            title: "Email alerts failed",
            body:
              emailJson.error ||
              "Split was created, but email alerts could not be sent.",
            relatedChainId: chainId,
            relatedBillId: billId,
          });
        } else {
          addNotification(address, {
            type: "reminder",
            title: "Email alerts processed",
            body: `${emailJson.sent ?? 0} sent, ${emailJson.failed ?? 0} failed.`,
            relatedChainId: chainId,
            relatedBillId: billId,
          });
        }
      } else {
        addNotification(address, {
          type: "reminder",
          title: "No email recipients found",
          body:
            "Add friend emails (Friends page) or recipient profile emails to send split alerts.",
          relatedChainId: chainId,
          relatedBillId: billId,
        });
      }

      logActivity(
        "bill_created",
        "Split created",
        `${name.trim()} · ${participants.length} participant(s) · ${amountStr} ${tokenSymbol}`,
        { chainId, txHash: tx.hash as string, billId }
      );
      showSuccessToast("Split created", `${participants.length} participant(s) added`);
      router.push(`/bill/${billId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create bill";
      setError(
        msg.includes("not deployed")
          ? isTempo
            ? "Tempo BillSplitter is not configured yet. Set NEXT_PUBLIC_TEMPO_BILLSPLITTER_ADDRESS, then retry."
            : "Deploy the BillSplitter contract first. See the yellow banner above."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutShell>
      <h2 className="mb-2 text-3xl font-semibold tracking-tight text-stone-900">
        Create split
      </h2>
      <p className="mb-8 text-base text-stone-600">
        Name your split, add participants, and set the stable token amount each person owes.
      </p>

      {isTempo && (
        <div className="mb-8 rounded-2xl border border-slate-300 bg-slate-50/95 p-5">
          <p className="font-semibold text-slate-900">Tempo integration is in progress</p>
          <p className="mt-1 text-sm text-slate-700">
            {contractDeployed
              ? "Tempo BillSplitter is configured. You can create Tempo splits with the selected token."
              : "Tempo token selection is now visible here. Set NEXT_PUBLIC_TEMPO_BILLSPLITTER_ADDRESS to enable Tempo split creation."}
          </p>
        </div>
      )}

      {!contractDeployed && (
        <div className="mb-8 rounded-2xl border border-amber-300/80 bg-amber-50/95 p-5">
          <p className="font-semibold text-amber-800">
            Contract not deployed yet
          </p>
          <p className="mt-1 text-sm text-amber-700">
            {isTempo ? (
              <>
                Set{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5">
                  NEXT_PUBLIC_TEMPO_BILLSPLITTER_ADDRESS
                </code>{" "}
                after deploying BillSplitter on Tempo testnet, then restart the app.
              </>
            ) : (
              <>
                Run <code className="rounded bg-amber-100 px-1 py-0.5">npm run deploy:arc</code> or{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5">npm run deploy:base</code> with your
                wallet&apos;s private key in .env, then add the deployed address to{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5">src/lib/chains.ts</code>. See README for
                details.
              </>
            )}
          </p>
        </div>
      )}

      {!isConnected ? (
        <div className="rounded-3xl border border-white/70 bg-white/85 p-8 text-center backdrop-blur">
          <p className="text-stone-600">Connect your wallet first.</p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/70 bg-white/85 p-6 backdrop-blur"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="split-name" className="block text-sm font-medium text-stone-700">
                Split name <span className="text-red-500">*</span>
              </label>
              <input
                id="split-name"
                name="splitName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dinner at Mario's"
                className={`mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-stone-900 placeholder:text-stone-400 ${accent.focus}`}
              />
            </div>
            <div>
              <label
                htmlFor="split-description"
                className="block text-sm font-medium text-stone-700"
              >
                Description <span className="text-stone-400">(optional)</span>
              </label>
              <textarea
                id="split-description"
                name="splitDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about this split..."
                rows={2}
                className={`mt-2 w-full resize-none rounded-2xl border border-stone-200 px-4 py-3 text-stone-900 placeholder:text-stone-400 ${accent.focus}`}
              />
            </div>
            <div>
              <label
                htmlFor="custom-reminder"
                className="block text-sm font-medium text-stone-700"
              >
                Custom email reminder <span className="text-stone-400">(optional)</span>
              </label>
              <input
                id="custom-reminder"
                name="customReminder"
                type="text"
                value={customReminder}
                onChange={(e) => setCustomReminder(e.target.value)}
                placeholder="e.g. Please pay by Friday!"
                className={`mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-stone-900 placeholder:text-stone-400 ${accent.focus}`}
              />
            </div>
            <div>
              <label htmlFor="split-token" className="block text-sm font-medium text-stone-700">
                Token
              </label>
              {availableTokens.length > 1 ? (
                <select
                  id="split-token"
                  value={selectedTokenAddress}
                  onChange={(e) => setSelectedTokenAddress(e.target.value)}
                  className={`mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-stone-900 ${accent.focus}`}
                >
                  {availableTokens.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-2 inline-flex rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-semibold text-stone-700">
                  {selectedToken?.symbol}
                </div>
              )}
            </div>
            <div>
              <label
                htmlFor="split-participants"
                className="block text-sm font-medium text-stone-700"
              >
                Participants
              </label>
              <textarea
                id="split-participants"
                name="participants"
                value={participantsStr}
                onChange={(e) => setParticipantsStr(e.target.value)}
                placeholder="0x123... or alice.base or vitalik.eth&#10;one per line or comma-separated"
                rows={6}
                className={`mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 font-mono text-sm text-stone-900 placeholder:text-stone-400 ${accent.focus}`}
              />
            </div>
            <div>
              <label htmlFor="split-amount" className="block text-sm font-medium text-stone-700">
                Amount per person ({tokenSymbol})
              </label>
              <input
                id="split-amount"
                name="amountPerPerson"
                type="text"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="10.00"
                className={`mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-stone-900 placeholder:text-stone-400 ${accent.focus}`}
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={loading || !contractDeployed}
              className={`rounded-2xl px-6 py-3 text-sm font-semibold text-white ${accent.bg} ${accent.hover} transition disabled:opacity-50`}
            >
              {!contractDeployed
                ? isTempo
                  ? "Configure Tempo BillSplitter first"
                  : "Contract required"
                : loading
                ? "Creating…"
                : "Create split"}
            </button>
            <Link
              href="/app"
              className="rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </LayoutShell>
  );
}
