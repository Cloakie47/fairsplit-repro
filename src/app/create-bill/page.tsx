"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { useRouter } from "next/navigation";

import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TransactionModal } from "@/components/TransactionModal";

import { getContract, parseBillId } from "@/lib/contract";
import { walletClientToSigner } from "@/lib/wallet";
import {
  getTokensForChain,
  getDefaultTokenForChain,
  isBillSplitterConfigured,
  CONTRACT_ADDRESSES,
  type SupportedToken,
} from "@/lib/chains";
import { logActivity } from "@/lib/activity";
import { showSuccessToast } from "@/lib/toast";
import { createSplitRequests } from "@/lib/requests";
import { parseParticipantInputs, resolveInputToAddress } from "@/lib/nameService";

export default function CreateBillPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [participantsInput, setParticipantsInput] = useState("");
  const [amountPerPerson, setAmountPerPerson] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tokens = getTokensForChain(chainId);
  const defaultToken = getDefaultTokenForChain(chainId);
  const selectedToken: SupportedToken | null =
    tokens.find((t) => t.address.toLowerCase() === selectedTokenAddress.toLowerCase()) ??
    defaultToken ?? null;
  const tokenSymbol = selectedToken?.symbol ?? "USDC";
  const tokenDecimals = selectedToken?.decimals ?? 6;
  const contractConfigured = isBillSplitterConfigured(chainId);
  const hasMultipleTokens = tokens.length > 1;

  useEffect(() => {
    setSelectedTokenAddress("");
  }, [chainId]);

  const onCreateBill = async () => {
    if (!isConnected || !walletClient || !address || !selectedToken) return;
    setLoading(true);
    setError(null);
    setStage(null);
    try {
      if (!contractConfigured) {
        throw new Error("BillSplitter contract is not configured for this chain.");
      }
      if (!name.trim()) throw new Error("Bill name is required.");
      const rawInputs = parseParticipantInputs(participantsInput);
      if (rawInputs.length === 0) throw new Error("Add at least one participant.");
      const amountRaw = ethers.parseUnits(amountPerPerson || "0", tokenDecimals);
      if (amountRaw <= BigInt(0)) throw new Error("Amount per person must be greater than 0.");

      const signer = await walletClientToSigner(walletClient);
      setStage("Resolving participant names...");
      const resolved: string[] = [];
      for (const input of rawInputs) {
        const addr = await resolveInputToAddress(input, chainId);
        resolved.push(addr);
      }

      const billId = parseBillId(`${name}-${Date.now()}`);
      const tokenAddress = selectedToken.address;

      setStage("Creating bill on-chain...");
      const contract = getContract(signer, chainId);
      const tx = await contract.createBill(
        billId,
        name.trim(),
        description.trim(),
        reminderMessage.trim(),
        tokenAddress,
        resolved,
        amountRaw
      );
      setStage("Waiting for confirmation...");
      await tx.wait();

      logActivity(
        address,
        "bill_created",
        `Created "${name}"`,
        `${resolved.length} participants`,
        {
          chainId,
          txHash: tx.hash as string,
          billId,
        }
      );

      createSplitRequests({
        chainId,
        billId,
        splitName: name.trim(),
        creatorAddress: address,
        participants: resolved,
        amountUsdc: amountPerPerson,
        tokenAddress,
        tokenSymbol,
        customReminder: reminderMessage,
      });

      showSuccessToast("Bill created", `"${name}" is now on-chain`);
      router.push(`/bill/${encodeURIComponent(billId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create bill.");
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  return (
    <LayoutShell>
      <TransactionModal open={loading} stage={stage} />

      <p className="label-text text-brand-red">■ FairSplit / Create Bill</p>
      <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black underline decoration-brand-red decoration-4 underline-offset-4">
        Create Bill
      </h1>
      <p className="mt-2 text-body text-brand-ink">
        Split a bill with friends. Each participant pays their share on-chain.
      </p>

      <Card className="mt-8 max-w-2xl p-6">
        <div className="space-y-5">
          <Input
            label="Bill Name"
            id="bill-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friday dinner, Rent split..."
          />

          <Input
            label="Description (optional)"
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes about this bill"
          />

          {hasMultipleTokens && (
            <div className="flex flex-col gap-1.5">
              <label className="label-text text-brand-muted">Token</label>
              <select
                value={selectedToken?.address ?? ""}
                onChange={(e) => setSelectedTokenAddress(e.target.value)}
                className="w-full border-2 border-brand-black bg-brand-bg px-4 py-3 font-mono text-body text-brand-black focus:bg-brand-yellow focus:shadow-brutal focus:-translate-x-px focus:-translate-y-px focus:outline-none"
              >
                {tokens.map((t) => (
                  <option key={t.address} value={t.address}>
                    {t.symbol} {t.name !== t.symbol ? `(${t.name})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="label-text text-brand-muted">
              Participants (addresses or names, comma-separated)
            </span>
            <textarea
              value={participantsInput}
              onChange={(e) => setParticipantsInput(e.target.value)}
              placeholder="0x123..., alice.base, bob.eth"
              rows={3}
              className="w-full border-2 border-brand-black bg-brand-bg px-4 py-3 font-mono text-body text-brand-black placeholder:text-brand-muted focus:bg-brand-yellow focus:shadow-brutal focus:-translate-x-px focus:-translate-y-px focus:outline-none"
            />
          </div>

          <Input
            label={`Amount per person (${tokenSymbol})`}
            id="amount-per-person"
            value={amountPerPerson}
            onChange={(e) => setAmountPerPerson(e.target.value)}
            placeholder="25.00"
          />

          <Input
            label="Custom Reminder Message (optional)"
            id="reminder"
            value={reminderMessage}
            onChange={(e) => setReminderMessage(e.target.value)}
            placeholder="Hey! Don't forget to pay your share"
          />

          {error && (
            <div className="border-2 border-brand-red bg-white p-3 font-mono text-xs text-brand-red">
              {error}
            </div>
          )}

          <Button
            variant="red"
            size="lg"
            className="w-full"
            onClick={onCreateBill}
            disabled={!isConnected || !walletClient || loading || !contractConfigured}
          >
            {loading
              ? "Creating..."
              : !contractConfigured
                ? "Contract not configured"
                : "Create Bill →"}
          </Button>
        </div>
      </Card>
    </LayoutShell>
  );
}
