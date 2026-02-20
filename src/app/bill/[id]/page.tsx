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
import { CONTRACT_ADDRESSES } from "@/lib/chains";
import { approveUsdc } from "@/lib/usdc";
import { performConfidentialPayment } from "@/lib/stabletrust";
import { logActivity } from "@/lib/activity";
import { markSplitRequestPaid } from "@/lib/requests";
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

  useEffect(() => {
    async function load() {
      if (!billId || !chainId) return;
      try {
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
        setError("Bill not found or contract not deployed.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [billId, chainId]);

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
        `${ethers.formatUnits(bill.amountPerParticipant, 6)} USDC for ${bill.name}`
      );
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
      const signer = await walletClientToSigner(walletClient);
      const contract = getContract(signer, chainId);

      await performConfidentialPayment(
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
            depositing: "Depositing to confidential balance...",
            transferring: "Submitting confidential transfer...",
            finalizing: "Waiting for finalization...",
            retrying: "Network is temporarily busy, retrying...",
          };
          setPaymentStatus(labels[next] ?? "Processing confidential payment...");
        }
      );

      const tx = await contract.markPaidConfidential(billId, address);
      setPaymentStatus("Confirming confidential bill status on contract...");
      await tx.wait();
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
        `${ethers.formatUnits(bill.amountPerParticipant, 6)} USDC confidential for ${bill.name}`
      );
      router.refresh();
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
    ? `${ethers.formatUnits(bill.amountPerParticipant, 6)} USDC`
    : "";

  return (
    <LayoutShell>
      <Link
        href="/"
        className="mb-5 inline-block rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800"
      >
        ← Back
      </Link>

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : error || !bill ? (
        <p className="text-red-600">{error ?? "Bill not found."}</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur">
            <h2 className="text-3xl font-semibold tracking-tight text-stone-900">{bill.name}</h2>
            {bill.description && (
              <p className="mt-2 text-base text-stone-600">{bill.description}</p>
            )}
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur">
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
