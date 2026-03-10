"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { useWalletClient } from "wagmi";
import { LayoutShell } from "@/components/LayoutShell";
import { ParticipantList } from "@/components/ParticipantList";
import { PaymentForm } from "@/components/PaymentForm";
import { getContract } from "@/lib/contract";
import {
  CONTRACT_ADDRESSES,
  getTokenByAddress,
  isBillSplitterConfigured,
  SUPPORTED_CHAINS,
} from "@/lib/chains";
import { approveUsdc } from "@/lib/usdc";
import {
  isConfidentialTransferConfigured,
  performConfidentialPayment,
  preflightConfidentialPayment,
} from "@/lib/stabletrust";
import { logActivity } from "@/lib/activity";
import { markSplitRequestPaid } from "@/lib/requests";
import { showSuccessToast } from "@/lib/toast";
import { getChainLabel } from "@/lib/explorer";
import { ethers } from "ethers";
import { walletClientToSigner } from "@/lib/wallet";

export default function BillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const billId = params.id as string;
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [bill, setBill] = useState<{
    creator: string;
    usdcToken: string;
    name: string;
    description: string;
    amountPerParticipant: bigint;
    participants: string[];
  } | null>(null);
  const [statuses, setStatuses] = useState<
    { paid: boolean; isConfidential: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const billToken = getTokenByAddress(chainId, bill?.usdcToken);
  const tokenSymbol = billToken?.symbol ?? "USDC";
  const confidentialTokenSymbol = billToken?.confidentialSymbol ?? `c${tokenSymbol}`;
  const contractConfigured = isBillSplitterConfigured(chainId);
  const confidentialConfigured = isConfidentialTransferConfigured(chainId);

  useEffect(() => {
    async function load() {
      if (!billId || !chainId) return;
      try {
        if (!contractConfigured) {
          setError(
            chainId === SUPPORTED_CHAINS.tempoTestnet.id
              ? "Tempo BillSplitter is not configured yet."
              : "Bill not found or contract not deployed."
          );
          setLoading(false);
          return;
        }
        const provider = new ethers.BrowserProvider(
          (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum!
        );
        const contract = getContract(provider, chainId);
        const [creator, usdcToken, name, description, amountPerParticipant, participants] =
          await contract.getBill(billId);
        const statusesData = await Promise.all(
          participants.map((p: string) =>
            contract.getParticipantStatus(billId, p)
          )
        );
        setBill({
          creator,
          usdcToken,
          name,
          description,
          amountPerParticipant,
          participants,
        });
        setStatuses(
          statusesData.map(([paid, isConfidential]: [boolean, boolean]) => ({
            paid,
            isConfidential,
          }))
        );
      } catch (e) {
        setError(
          chainId === SUPPORTED_CHAINS.tempoTestnet.id
            ? "Tempo bill not found, or Tempo BillSplitter is not configured."
            : "Bill not found or contract not deployed."
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [billId, chainId, contractConfigured]);

  const payNormal = async () => {
    if (!walletClient || !bill || !chainId) return;
    try {
      const contractAddr = CONTRACT_ADDRESSES[chainId];
      if (!contractAddr) return;
      setPaymentStatus("Preparing normal payment...");
      const signer = await walletClientToSigner(walletClient);
      const contract = getContract(signer, chainId);

      await approveUsdc(
        bill.usdcToken,
        contractAddr,
        bill.amountPerParticipant,
        signer
      );
      const tx = await contract.payNormal(billId);
      setPaymentStatus("Waiting for normal payment confirmation...");
      await tx.wait();
      markSplitRequestPaid({
        chainId,
        billId,
        participantAddress: address ?? "",
        mode: "normal",
        splitName: bill.name,
        creatorAddress: bill.creator,
      });
      logActivity(
        "bill_paid_normal",
        "Bill paid (normal)",
        `${ethers.formatUnits(bill.amountPerParticipant, 6)} ${tokenSymbol} for ${bill.name}`,
        { chainId, txHash: tx.hash as string, billId }
      );
      showSuccessToast("Payment successful", `Normal ${tokenSymbol} payment confirmed`);
      router.refresh();
      setStatuses((prev) =>
        prev.map((s, i) =>
          bill.participants[i]?.toLowerCase() === address?.toLowerCase()
            ? { paid: true, isConfidential: false }
            : s
        )
      );
      setPaymentStatus(null);
    } catch (e) {
      setPaymentStatus(null);
      throw e;
    }
  };

  const payConfidential = async () => {
    if (!walletClient || !bill || !chainId || !address) return;
    try {
      if (!confidentialConfigured) {
        throw new Error(
          chainId === SUPPORTED_CHAINS.tempoTestnet.id
            ? `Tempo confidential ${tokenSymbol} payments need NEXT_PUBLIC_TEMPO_STABLETRUST_ADDRESS before they can be used.`
            : "Confidential payments are not configured for this chain."
        );
      }
      const signer = await walletClientToSigner(walletClient);
      const contract = getContract(signer, chainId);
      setPaymentStatus("Running confidential preflight checks...");
      await preflightConfidentialPayment(
        signer,
        bill.creator,
        bill.usdcToken,
        bill.amountPerParticipant,
        chainId
      );
      setPaymentStatus("Preflight complete. Opening wallet...");

      const confidentialTransferHash = await performConfidentialPayment(
        signer,
        bill.creator,
        bill.usdcToken,
        bill.amountPerParticipant,
        chainId,
        (next) => {
          const labels: Record<string, string> = {
            awaiting_signature: "Waiting for wallet signature...",
            creating_account: "Initializing confidential account...",
            checking_recipient: "Checking recipient confidential account...",
            depositing: `Depositing to ${confidentialTokenSymbol} balance...`,
            transferring: "Submitting confidential transfer...",
            finalizing: "Waiting for finalization...",
            retrying: "Network is temporarily busy, retrying...",
          };
          setPaymentStatus(labels[next] ?? "Processing confidential payment...");
        }
      );

      let markedOnChain = false;
      let markTxHash: string | undefined;
      const isArcCreatorOnlyPath =
        chainId === SUPPORTED_CHAINS.arcTestnet.id &&
        address.toLowerCase() !== bill.creator.toLowerCase();
      if (isArcCreatorOnlyPath) {
        setPaymentStatus(
          "Confidential payment sent. On this Arc contract version, the split creator must confirm it on-chain."
        );
      } else {
        try {
          const tx = await contract.markPaidConfidential(billId, address);
          markTxHash = tx.hash as string;
          setPaymentStatus("Confirming confidential bill status on contract...");
          await tx.wait();
          markedOnChain = true;
        } catch (markError) {
          const message =
            markError instanceof Error
              ? markError.message.toLowerCase()
              : String(markError).toLowerCase();
          const creatorOnly = message.includes("only creator can mark confidential pay");
          if (!creatorOnly) {
            throw markError;
          }
          setPaymentStatus(
            "Confidential payment sent. On this Arc contract version, the split creator must confirm it on-chain."
          );
        }
      }

      markSplitRequestPaid({
        chainId,
        billId,
        participantAddress: address,
        mode: "confidential",
        splitName: bill.name,
        creatorAddress: bill.creator,
      });
      logActivity(
        "bill_paid_confidential",
        "Bill paid (confidential)",
        `${ethers.formatUnits(bill.amountPerParticipant, 6)} ${tokenSymbol} confidential for ${bill.name}`,
        { chainId, txHash: markTxHash ?? confidentialTransferHash, billId }
      );
      showSuccessToast("Payment successful", "Confidential payment submitted");
      if (markedOnChain) {
        router.refresh();
      }
      setStatuses((prev) =>
        prev.map((s, i) =>
          bill.participants[i]?.toLowerCase() === address.toLowerCase()
            ? { paid: true, isConfidential: true }
            : s
        )
      );
      setPaymentStatus(null);
    } catch (e) {
      setPaymentStatus(null);
      throw e;
    }
  };

  const participantsWithStatus =
    bill?.participants.map((addr, i) => ({
      address: addr,
      paid: statuses[i]?.paid ?? false,
      isConfidential: statuses[i]?.isConfidential ?? false,
    })) ?? [];

  const isPayer =
    !!address &&
    bill?.participants.some(
      (p) => p.toLowerCase() === address.toLowerCase()
    );
  const myIdx: number =
    address && bill
      ? bill.participants.findIndex(
          (p) => p.toLowerCase() === address.toLowerCase()
        )
      : -1;
  const alreadyPaid = myIdx >= 0 && (statuses[myIdx]?.paid ?? false);

  const amountFormatted = bill
    ? `${ethers.formatUnits(bill.amountPerParticipant, 6)} ${tokenSymbol}`
    : "";

  return (
    <LayoutShell>
      <Link
        href="/app"
        className="mb-5 inline-block rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
      >
        ← Back
      </Link>

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : error || !bill ? (
        <p className="text-red-600">{error ?? "Bill not found."}</p>
      ) : (
        <div className="space-y-6">
          {chainId === SUPPORTED_CHAINS.tempoTestnet.id && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                contractConfigured
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {contractConfigured
                ? confidentialConfigured
                  ? "Tempo BillSplitter and confidential routing are configured for this bill."
                  : "Tempo BillSplitter is configured. Add Tempo StableTrust config to enable confidential bill payments."
                : "Tempo bill execution is unavailable until NEXT_PUBLIC_TEMPO_BILLSPLITTER_ADDRESS is configured."}
            </div>
          )}
          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-semibold tracking-tight text-stone-900">{bill.name}</h2>
              {chainId && (
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-700">
                  {getChainLabel(chainId)}
                </span>
              )}
            </div>
            {bill.description && (
              <p className="mt-2 text-base text-stone-600">{bill.description}</p>
            )}
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 backdrop-blur">
            <p className="text-sm text-stone-500">Amount per person</p>
            <p className="text-2xl font-semibold text-stone-900">{amountFormatted}</p>
          </div>

          <ParticipantList
            participants={participantsWithStatus}
            amountFormatted={amountFormatted}
          />

          {isConnected && (
            <PaymentForm
              billId={billId}
              amountWei={bill.amountPerParticipant}
              amountFormatted={amountFormatted}
              tokenSymbol={tokenSymbol}
              confidentialTokenSymbol={confidentialTokenSymbol}
              onPayNormal={payNormal}
              onPayConfidential={payConfidential}
              isPayer={!!isPayer}
              alreadyPaid={!!alreadyPaid}
              paymentStatus={paymentStatus}
            />
          )}
        </div>
      )}
    </LayoutShell>
  );
}
