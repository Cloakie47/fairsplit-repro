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

import { CONTRACTS } from "@/config/contracts";
import {
  calculateFee,
  formatUsdc,
  getFairsplitV2Contract,
  parseUsdc,
} from "@/lib/contract";
import { walletClientToSigner } from "@/lib/wallet";
import {
  getTokensForChain,
  getDefaultTokenForChain,
  type SupportedToken,
} from "@/lib/chains";
import { logActivity } from "@/lib/activity";
import { showSuccessToast } from "@/lib/toast";
import { createSplitRequests } from "@/lib/requests";
import { parseParticipantInputs, resolveInputToAddress } from "@/lib/nameService";
import { saveParticipants, saveSplit } from "@/lib/supabase";

export default function CreateBillPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [splitUiMode, setSplitUiMode] = useState<"simple" | "advanced">("simple");
  const [uiSplitType, setUiSplitType] = useState<
    "equal" | "fixed" | "percentage" | "shares"
  >("equal");
  const [splitMode, setSplitMode] = useState<
    "equal" | "fixed" | "percentage" | "shares"
  >("equal");
  const [participantsInput, setParticipantsInput] = useState("");
  const [participantDraft, setParticipantDraft] = useState("");
  const [amountPerPerson, setAmountPerPerson] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paidByInput, setPaidByInput] = useState("");
  const [participantAmounts, setParticipantAmounts] = useState<string[]>([]);
  const [participantPercentages, setParticipantPercentages] = useState<string[]>([]);
  const [participantShares, setParticipantShares] = useState<string[]>([]);
  const [participantPaid, setParticipantPaid] = useState<boolean[]>([]);
  const [participantPaidBy, setParticipantPaidBy] = useState<("self" | "other")[]>([]);
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
  const contractConfigured = Boolean(
    CONTRACTS.baseSepolia.fairsplitV2 || CONTRACTS.base.fairsplitV2
  );
  const hasMultipleTokens = tokens.length > 1;
  const participantEntries = parseParticipantInputs(participantsInput);
  const previewParticipantsCount = participantEntries.length;
  const unpaidParticipantIndices = participantEntries
    .map((_, index) => index)
    .filter((index) => !participantPaid[index]);
  const unpaidParticipantEntries = unpaidParticipantIndices.map(
    (index) => participantEntries[index]
  );
  const unpaidCount = unpaidParticipantEntries.length;
  const paidCount = participantEntries.length - unpaidCount;
  const previewModeAmount = (() => {
    const source = totalAmount;
    try {
      return parseUsdc(source || "0");
    } catch {
      return BigInt(0);
    }
  })();
  const participantCount = participantEntries.length;
  const equalAmountPerPersonBigInt =
    participantCount > 0 ? previewModeAmount / BigInt(participantCount) : BigInt(0);
  const perParticipantAmountsForFee: bigint[] = (() => {
    if (participantCount === 0 || previewModeAmount <= BigInt(0)) return [];
    if (splitMode === "equal") {
      return participantEntries.map(() => equalAmountPerPersonBigInt);
    }
    if (splitMode === "fixed") {
      return participantEntries.map((_, index) => {
        const value = participantAmounts[index] ?? "";
        if (!value.trim()) return BigInt(0);
        try {
          return parseUsdc(value);
        } catch {
          return BigInt(0);
        }
      });
    }
    if (splitMode === "percentage") {
      return participantEntries.map((_, index) => {
        const n = Number(participantPercentages[index] ?? "0");
        const bps = Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
        return (previewModeAmount * BigInt(bps)) / BigInt(10_000);
      });
    }
    const sharesScaled = participantEntries.map((_, index) => {
      const n = Number(participantShares[index] ?? "0");
      if (!Number.isFinite(n) || n <= 0) return BigInt(0);
      return BigInt(Math.round(n * 1_000_000));
    });
    const totalSharesScaled = sharesScaled.reduce((sum, next) => sum + next, BigInt(0));
    if (totalSharesScaled <= BigInt(0)) return participantEntries.map(() => BigInt(0));
    return sharesScaled.map((share) => (previewModeAmount * share) / totalSharesScaled);
  })();
  const settledAmountBigInt = perParticipantAmountsForFee.reduce((sum, amount, index) => {
    if (!participantPaid[index]) return sum;
    return sum + amount;
  }, BigInt(0));
  const outstandingAmountBigInt =
    previewModeAmount > settledAmountBigInt
      ? previewModeAmount - settledAmountBigInt
      : BigInt(0);
  const feePerPersonForEqual =
    splitMode === "equal" && participantCount > 0
      ? calculateFee(equalAmountPerPersonBigInt)
      : BigInt(0);
  const creatorReceivesPerPersonForEqual =
    equalAmountPerPersonBigInt > feePerPersonForEqual
      ? equalAmountPerPersonBigInt - feePerPersonForEqual
      : BigInt(0);
  const totalFees = perParticipantAmountsForFee.reduce((sum, amount) => {
    if (amount <= BigInt(0)) return sum;
    return sum + calculateFee(amount);
  }, BigInt(0));
  const totalCreatorReceives =
    splitMode === "equal"
      ? creatorReceivesPerPersonForEqual * BigInt(participantCount)
      : perParticipantAmountsForFee.reduce((sum, amount) => {
          const fee = amount > BigInt(0) ? calculateFee(amount) : BigInt(0);
          const net = amount > fee ? amount - fee : BigInt(0);
          return sum + net;
        }, BigInt(0));
  const previewInputAmountDisplay = (() => {
    const source = totalAmount;
    const n = Number(source);
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();
  const parsedParticipantAmounts = unpaidParticipantIndices.map((index) => {
    const value = participantAmounts[index] ?? "";
    if (!value.trim()) return BigInt(0);
    try {
      return parseUsdc(value);
    } catch {
      return BigInt(0);
    }
  });
  const participantAmountSum = parsedParticipantAmounts.reduce(
    (sum, amount) => sum + amount,
    BigInt(0)
  );
  const parsedParticipantBps = unpaidParticipantIndices.map((index) => {
    const value = participantPercentages[index] ?? "";
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n < 0) return null;
    return Math.round(n * 100);
  });
  const participantBpsSum = parsedParticipantBps.reduce<number>(
    (sum, bps) => sum + (bps ?? 0),
    0
  );
  const amountsAllFilled =
    unpaidCount > 0 &&
    unpaidParticipantIndices.every(
      (index) => (participantAmounts[index] ?? "").trim().length > 0
    );
  const percentagesAllFilled =
    unpaidCount > 0 &&
    unpaidParticipantIndices.every(
      (index) => (participantPercentages[index] ?? "").trim().length > 0
    );
  const sharesAllFilled =
    unpaidCount > 0 &&
    unpaidParticipantIndices.every(
      (index) => (participantShares[index] ?? "").trim().length > 0
    );
  const sharesAllPositive =
    sharesAllFilled &&
    unpaidParticipantIndices.every((index) => {
      const n = Number(participantShares[index] ?? "0");
      return Number.isFinite(n) && n > 0;
    });
  const parsedParticipantShares = unpaidParticipantIndices.map((index) => {
    const n = Number(participantShares[index] ?? "0");
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const sharesSum = parsedParticipantShares.reduce((sum, next) => sum + next, 0);
  const baseFormValid =
    !!name.trim() && previewModeAmount > BigInt(0) && unpaidCount > 0 && outstandingAmountBigInt > BigInt(0);
  let canSubmitByMode = false;
  if (splitMode === "equal") {
    canSubmitByMode = baseFormValid;
  } else if (splitMode === "fixed") {
    canSubmitByMode =
      baseFormValid && amountsAllFilled && participantAmountSum === outstandingAmountBigInt;
  } else if (splitMode === "percentage") {
    canSubmitByMode =
      baseFormValid && percentagesAllFilled && participantBpsSum === 10000;
  } else {
    canSubmitByMode = baseFormValid && sharesAllPositive;
  }

  useEffect(() => {
    setSelectedTokenAddress("");
  }, [chainId]);

  useEffect(() => {
    if (splitUiMode === "simple") {
      setUiSplitType("equal");
      setSplitMode("equal");
      setParticipantPaid((prev) => prev.map(() => false));
      setParticipantPaidBy((prev) => prev.map(() => "self"));
      return;
    }
    setSplitMode(uiSplitType);
  }, [uiSplitType, splitUiMode]);

  useEffect(() => {
    setAmountPerPerson(totalAmount);
  }, [totalAmount]);

  useEffect(() => {
    setParticipantAmounts((prev) =>
      participantEntries.map((_, index) => prev[index] ?? "")
    );
    setParticipantPercentages((prev) =>
      participantEntries.map((_, index) => prev[index] ?? "")
    );
    setParticipantShares((prev) =>
      participantEntries.map((_, index) => prev[index] ?? "")
    );
    setParticipantPaid((prev) =>
      participantEntries.map((_, index) => prev[index] ?? false)
    );
    setParticipantPaidBy((prev) =>
      participantEntries.map((_, index) => prev[index] ?? "self")
    );
  }, [participantsInput]);

  useEffect(() => {
    if (splitMode !== "fixed") return;
    if (participantEntries.length === 0) return;
    const paidIndices = participantEntries
      .map((_, index) => index)
      .filter((index) => participantPaid[index]);
    if (paidIndices.length === 0) return;
    const unpaidIndices = participantEntries
      .map((_, index) => index)
      .filter((index) => !participantPaid[index]);
    if (unpaidIndices.length === 0) return;

    let totalBigInt = BigInt(0);
    try {
      totalBigInt = parseUsdc(totalAmount || "0");
    } catch {
      totalBigInt = BigInt(0);
    }

    const settledBigInt = paidIndices.reduce((sum, index) => {
      const raw = participantAmounts[index] ?? "0";
      try {
        return sum + parseUsdc(raw || "0");
      } catch {
        return sum;
      }
    }, BigInt(0));
    const outstandingBigInt =
      totalBigInt > settledBigInt ? totalBigInt - settledBigInt : BigInt(0);
    const base = outstandingBigInt / BigInt(unpaidIndices.length);
    const remainder = outstandingBigInt - base * BigInt(unpaidIndices.length);

    setParticipantAmounts((prev) => {
      const next = [...prev];
      unpaidIndices.forEach((index, i) => {
        const amount = base + (i === unpaidIndices.length - 1 ? remainder : BigInt(0));
        next[index] = formatUsdc(amount);
      });
      const changed = next.some((value, i) => value !== (prev[i] ?? ""));
      return changed ? next : prev;
    });
  }, [splitMode, participantEntries, participantPaid, totalAmount, participantAmounts]);

  const addParticipant = () => {
    const next = participantDraft.trim();
    if (!next) return;
    const list = parseParticipantInputs(participantsInput);
    setParticipantsInput([...list, next].join(", "));
    setParticipantDraft("");
  };

  const addYourself = () => {
    const selfAddress = address ?? walletClient?.account?.address;
    if (!selfAddress) {
      setError("Connect your wallet to add yourself.");
      return;
    }
    const list = parseParticipantInputs(participantsInput);
    if (list.some((item) => item.toLowerCase() === selfAddress.toLowerCase())) {
      setError("You are already in the participant list.");
      return;
    }
    setError(null);
    setParticipantsInput([...list, selfAddress].join(", "));
  };

  const removeParticipant = (index: number) => {
    const list = parseParticipantInputs(participantsInput);
    const next = list.filter((_, i) => i !== index);
    setParticipantsInput(next.join(", "));
    setParticipantAmounts((prev) => prev.filter((_, i) => i !== index));
    setParticipantPercentages((prev) => prev.filter((_, i) => i !== index));
    setParticipantShares((prev) => prev.filter((_, i) => i !== index));
  };

  const perPersonPreviewValues = participantEntries.map((entry, index) => {
    if (participantPaid[index]) {
      return { label: entry, amount: 0, paid: true };
    }
    if (splitMode === "fixed") {
      const n = Number(participantAmounts[index] ?? "0");
      return {
        label: entry,
        amount: Number.isFinite(n) ? Math.max(0, n) : 0,
        paid: false,
      };
    }
    if (splitMode === "percentage") {
      const percent = Number(participantPercentages[index] ?? "0");
      const ratio = Number.isFinite(percent) ? Math.max(0, percent) / 100 : 0;
      return { label: entry, amount: previewInputAmountDisplay * ratio, paid: false };
    }
    if (splitMode === "shares") {
      const unpaidIndex = unpaidParticipantIndices.indexOf(index);
      const share = unpaidIndex >= 0 ? parsedParticipantShares[unpaidIndex] ?? 0 : 0;
      const ratio = sharesSum > 0 ? share / sharesSum : 0;
      return { label: entry, amount: previewInputAmountDisplay * ratio, paid: false };
    }
    const equalShare =
      unpaidCount > 0
        ? previewInputAmountDisplay / unpaidCount
        : 0;
    return { label: entry, amount: equalShare, paid: false };
  });
  const expectedPerPersonAmounts = participantEntries.map((_, index) => {
    if (splitMode === "equal") {
      return previewParticipantsCount > 0
        ? previewInputAmountDisplay / previewParticipantsCount
        : 0;
    }
    if (splitMode === "fixed") {
      const n = Number(participantAmounts[index] ?? "0");
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }
    if (splitMode === "percentage") {
      const percent = Number(participantPercentages[index] ?? "0");
      return Number.isFinite(percent) ? (previewInputAmountDisplay * percent) / 100 : 0;
    }
    const shares = participantEntries.map((__, i) => {
      const n = Number(participantShares[i] ?? "0");
      return Number.isFinite(n) && n > 0 ? n : 0;
    });
    const allShares = shares.reduce((sum, next) => sum + next, 0);
    return allShares > 0 ? (previewInputAmountDisplay * shares[index]) / allShares : 0;
  });
  const settledAmountDisplay = formatUsdc(settledAmountBigInt);
  const outstandingAmountDisplay = formatUsdc(outstandingAmountBigInt);
  const totalAssignedDisplay = formatUsdc(settledAmountBigInt + participantAmountSum);

  const onCreateBill = async () => {
    if (!isConnected || !walletClient || !address || !selectedToken) return;
    setLoading(true);
    setError(null);
    setStage(null);
    try {
      if (!contractConfigured) throw new Error("Contract not configured.");
      if (chainId !== CONTRACTS.baseSepolia.chainId) {
        throw new Error("Please switch to Base Sepolia");
      }
      if (!name.trim()) throw new Error("Bill name is required.");
      const rawInputs = unpaidParticipantEntries;
      if (participantEntries.length === 0) throw new Error("Add at least one participant.");
      if (rawInputs.length === 0) {
        throw new Error("At least one participant must be pending payment.");
      }
      let totalAmountBigInt: bigint;
      let splitType: 0 | 1 | 2;
      let customAmounts: bigint[];
      if (splitMode === "equal") {
        totalAmountBigInt = outstandingAmountBigInt;
        if (totalAmountBigInt <= BigInt(0)) {
          throw new Error("Outstanding amount must be greater than 0.");
        }
        splitType = 0;
        customAmounts = [];
      } else if (splitMode === "fixed") {
        totalAmountBigInt = outstandingAmountBigInt;
        if (totalAmountBigInt <= BigInt(0)) {
          throw new Error("Outstanding amount must be greater than 0.");
        }
        if (!amountsAllFilled) {
          throw new Error("Enter all participant amounts.");
        }
        customAmounts = unpaidParticipantIndices.map((index) =>
          parseUsdc(participantAmounts[index] ?? "0")
        );
        const fixedSum = customAmounts.reduce((sum, next) => sum + next, BigInt(0));
        if (fixedSum !== totalAmountBigInt) {
          throw new Error("Participant amounts must equal outstanding amount.");
        }
        splitType = 1;
      } else if (splitMode === "percentage") {
        totalAmountBigInt = outstandingAmountBigInt;
        if (totalAmountBigInt <= BigInt(0)) {
          throw new Error("Outstanding amount must be greater than 0.");
        }
        if (!percentagesAllFilled) {
          throw new Error("Enter all participant percentages.");
        }
        const bpsValues = unpaidParticipantIndices.map((index) => {
          const value = participantPercentages[index] ?? "0";
          const n = Number(value);
          if (!Number.isFinite(n) || n < 0) {
            throw new Error("Enter valid participant percentages.");
          }
          return Math.round(n * 100);
        });
        const bpsSum = bpsValues.reduce((sum, next) => sum + next, 0);
        if (bpsSum !== 10000) {
          throw new Error("Participant percentages must equal 100%.");
        }
        customAmounts = bpsValues.map((bps) => BigInt(bps));
        splitType = 2;
      } else {
        totalAmountBigInt = outstandingAmountBigInt;
        if (totalAmountBigInt <= BigInt(0)) {
          throw new Error("Outstanding amount must be greater than 0.");
        }
        if (!sharesAllPositive) {
          throw new Error("Enter valid share values greater than 0.");
        }
        const shareUnits = unpaidParticipantIndices.map((index) => {
          const value = participantShares[index] ?? "0";
          const parsed = Math.round(Number(value) * 1_000_000);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new Error("Enter valid share values greater than 0.");
          }
          return BigInt(parsed);
        });
        const shareTotal = shareUnits.reduce((sum, next) => sum + next, BigInt(0));
        customAmounts = shareUnits.map(
          (share) => (totalAmountBigInt * share) / shareTotal
        );
        const allocated = customAmounts.reduce((sum, next) => sum + next, BigInt(0));
        if (allocated < totalAmountBigInt && customAmounts.length > 0) {
          customAmounts[customAmounts.length - 1] += totalAmountBigInt - allocated;
        }
        splitType = 1;
      }

      const signer = await walletClientToSigner(walletClient);
      const currentChainId = Number(chainId);
      setStage("Resolving participant names...");
      const resolved: string[] = [];
      for (const input of rawInputs) {
        const addr = await resolveInputToAddress(input, currentChainId);
        resolved.push(addr);
      }

      const fairsplit = getFairsplitV2Contract(signer, currentChainId);
      const fairsplitAddress =
        currentChainId === CONTRACTS.base.chainId
          ? CONTRACTS.base.fairsplitV2
          : CONTRACTS.baseSepolia.fairsplitV2;
      if (!fairsplitAddress) {
        throw new Error("Contract not configured.");
      }

      setStage("Creating split on-chain...");
      const tx = await fairsplit.createSplit(
        resolved,
        totalAmountBigInt,
        splitType,
        customAmounts
      );
      setStage("Waiting for confirmation...");
      const receipt = await tx.wait();
      const splitCreatedTopic = ethers.id(
        "SplitCreated(uint256,address,uint256,uint256,uint8,uint256)"
      );
      let splitId: string | null = null;
      for (const log of receipt.logs) {
        if (!log.topics?.length || log.topics[0] !== splitCreatedTopic) {
          continue;
        }
        const parsed = fairsplit.interface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (parsed?.name === "SplitCreated") {
          splitId = (parsed.args.splitId as bigint).toString();
          break;
        }
      }
      if (!splitId) {
        throw new Error("Transaction failed. Please try again.");
      }

      logActivity(
        address,
        "bill_created",
        `Created "${name}"`,
        `${resolved.length} participants`,
        {
          chainId: currentChainId,
          txHash: tx.hash as string,
          billId: splitId,
        }
      );

      try {
        await saveSplit({
          splitId,
          chainId: currentChainId,
          contractAddress: fairsplitAddress,
          creatorAddress: address,
          name: name.trim(),
          description: description.trim(),
          totalAmount: formatUsdc(totalAmountBigInt),
          splitType,
          participantCount: resolved.length,
        });

        await saveParticipants(
          splitId,
          currentChainId,
          resolved.map((wallet, index) => ({
            address: wallet,
            customAmount:
              splitType === 1 && customAmounts[index] !== undefined
                ? formatUsdc(customAmounts[index])
                : undefined,
          }))
        );
      } catch (syncErr) {
        console.warn("[create-bill] supabase split metadata sync", syncErr);
      }

      try {
        await createSplitRequests({
          chainId: currentChainId,
          billId: splitId,
          splitName: name.trim(),
          creatorAddress: address,
          participants: resolved,
          amountUsdc: formatUsdc(totalAmountBigInt),
          tokenAddress: selectedToken.address,
          tokenSymbol,
          customReminder: reminderMessage,
        });
      } catch (syncErr) {
        console.warn("[create-bill] split request cloud sync", syncErr);
      }

      showSuccessToast("Bill created", `"${name}" is now on-chain`);
      router.push(`/bill/${encodeURIComponent(splitId)}`);
    } catch (e) {
      const err = e as { code?: string | number; message?: string };
      const msg = err?.message ?? "";
      if (err?.code === 4001 || err?.code === "ACTION_REJECTED") {
        setError("Transaction cancelled");
      } else if (msg.includes("Please switch to Base Sepolia")) {
        setError("Please switch to Base Sepolia");
      } else if (msg.includes("Insufficient USDC balance")) {
        setError("Insufficient USDC balance");
      } else {
        setError("Transaction failed. Please try again.");
      }
    } finally {
      setStage(null);
      setLoading(false);
    }
  };

  return (
    <LayoutShell>
      <TransactionModal open={loading} stage={stage} />

      <p className="label-text text-brand-muted">
        FAIRYSPLIT <span className="text-brand-red">/</span>{" "}
        <span className="text-brand-red">CREATE BILL</span>
      </p>
      <h1 className="mt-2 font-grotesk text-page-title font-bold uppercase text-brand-black underline decoration-brand-red decoration-4 underline-offset-4">
        Create Bill
      </h1>
      <p className="mt-2 text-body text-brand-ink">
        Split a bill with friends. Each participant pays their share on-chain.
      </p>
      <div className="mt-6 inline-flex w-full border-2 border-brand-black bg-white shadow-brutal md:w-auto">
        <button
          type="button"
          onClick={() => setSplitUiMode("simple")}
          className={`min-h-[44px] flex-1 border-r-2 border-brand-black px-4 py-2 font-mono text-xs uppercase tracking-wide transition-all md:px-6 ${
            splitUiMode === "simple"
              ? "bg-brand-lime text-brand-black"
              : "bg-brand-bg text-brand-black hover:bg-brand-yellow"
          }`}
        >
          Simple Split
        </button>
        <button
          type="button"
          onClick={() => setSplitUiMode("advanced")}
          className={`min-h-[44px] flex-1 px-4 py-2 font-mono text-xs uppercase tracking-wide transition-all md:px-6 ${
            splitUiMode === "advanced"
              ? "bg-brand-lime text-brand-black"
              : "bg-brand-bg text-brand-black hover:bg-brand-yellow"
          }`}
        >
          Advanced Split
        </button>
      </div>

      <div className="mt-8 flex flex-col items-start gap-6 lg:flex-row">
        <Card className="w-full flex-1 border-brand-black bg-[#f5f5f2] p-6 shadow-[6px_6px_0_#0A0A0A]">
          <div className="space-y-5">
            <Input
              label="Bill Name"
              id="bill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday dinner, Rent split..."
            />

            <div className="flex flex-col gap-1.5">
              <span className="label-text text-brand-muted">
                Description (optional)
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes about this bill"
                rows={3}
                className="w-full border-2 border-brand-black bg-brand-bg px-4 py-3 font-mono text-body text-brand-black placeholder:text-brand-muted focus:bg-brand-yellow focus:shadow-brutal focus:-translate-x-px focus:-translate-y-px focus:outline-none"
              />
            </div>

            {splitUiMode === "advanced" ? (
              <div className="flex flex-col gap-1.5">
                <span className="label-text text-brand-muted">Split Type</span>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    { id: "equal", label: "Equal" },
                    { id: "fixed", label: "Custom" },
                    { id: "percentage", label: "By Percentage" },
                    { id: "shares", label: "By Shares" },
                  ].map((option) => {
                    const active = uiSplitType === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setUiSplitType(
                            option.id as "equal" | "fixed" | "percentage" | "shares"
                          )
                        }
                        className={`border-2 border-brand-black px-3 py-2 text-center font-mono text-xs uppercase tracking-wide transition-all ${
                          active
                            ? "bg-brand-lime text-brand-black shadow-brutal -translate-x-px -translate-y-px"
                            : "bg-white text-brand-black hover:bg-brand-yellow"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {splitUiMode === "advanced" && (
              <div className="border-2 border-brand-black bg-[#efefdf] px-3 py-2">
                <p className="font-mono text-xs text-brand-muted">
                  // Everyone pays equally. Total / number of unpaid participants.
                </p>
              </div>
            )}

            {splitUiMode === "simple" ? (
              <Input
                label={`Total Amount (${tokenSymbol})`}
                id="total-amount"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input
                  label={`Total Amount (${tokenSymbol})`}
                  id="total-amount"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                />
                <Input
                  label="Paid By"
                  id="paid-by"
                  value={paidByInput}
                  onChange={(e) => setPaidByInput(e.target.value)}
                  placeholder="alice.base or 0x..."
                />
              </div>
            )}
            {splitMode === "equal" && (
              <div className="flex flex-col gap-1.5">
                <span className="label-text text-brand-muted">Amount per person</span>
                <input
                  disabled
                  value={
                    unpaidCount > 0
                      ? (previewInputAmountDisplay / unpaidCount).toFixed(2)
                      : "0.00"
                  }
                  className="w-full border-2 border-brand-black bg-neutral-100 px-4 py-3 font-mono text-body text-brand-black"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="label-text text-brand-muted">
                Participants (address or ENS)
              </span>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input
                  value={participantDraft}
                  onChange={(e) => setParticipantDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addParticipant();
                    }
                  }}
                  placeholder="0x123..., alice.base, bob.eth"
                  className="w-full border-2 border-brand-black bg-brand-bg px-4 py-3 font-mono text-body text-brand-black placeholder:text-brand-muted focus:bg-brand-yellow focus:shadow-brutal focus:-translate-x-px focus:-translate-y-px focus:outline-none"
                />
                <Button
                  type="button"
                  variant="white"
                  size="md"
                  className="h-[49px] w-full shrink-0 md:w-24"
                  onClick={addParticipant}
                >
                  + Add
                </Button>
                {splitUiMode === "advanced" && (
                  <Button
                    type="button"
                    variant="white"
                    size="md"
                    className="h-[49px] w-full shrink-0 md:w-24"
                    onClick={addYourself}
                  >
                    + You
                  </Button>
                )}
              </div>
              {splitUiMode === "advanced" && (
                <div className="grid grid-cols-[1fr_180px] border-2 border-brand-black bg-brand-black px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-brand-bg">
                  <span>Participant</span>
                  <span className="text-right">Split / Paid</span>
                </div>
              )}
              <div className="space-y-2">
                {participantEntries.map((entry, index) => {
                  const avatar = entry.replace(/^0x/i, "").slice(0, 2).toUpperCase() || "??";
                  const equalShare =
                    unpaidCount > 0
                      ? previewInputAmountDisplay / unpaidCount
                      : 0;
                  return (
                    <div
                      key={`${entry}-${index}`}
                      className={`flex flex-col items-stretch gap-2 border-2 border-brand-black px-3 py-2 md:flex-row md:items-center md:gap-3 ${
                        splitUiMode === "advanced" && participantPaid[index]
                          ? "bg-[#d9f2de]"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center border-2 border-brand-black bg-brand-lime font-mono text-xs font-bold text-brand-black">
                        {avatar}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs text-brand-black">
                          {entry}
                        </p>
                        {splitUiMode === "advanced" && (
                          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-brand-muted">
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={participantPaid[index] ?? false}
                                onChange={(e) =>
                                  setParticipantPaid((prev) => {
                                    const next = [...prev];
                                    next[index] = e.target.checked;
                                    return next;
                                  })
                                }
                              />
                              Paid
                            </label>
                            {(participantPaid[index] ?? false) && (
                              <select
                                value={participantPaidBy[index] ?? "self"}
                                onChange={(e) =>
                                  setParticipantPaidBy((prev) => {
                                    const next = [...prev];
                                    next[index] = e.target.value as "self" | "other";
                                    return next;
                                  })
                                }
                                className="border border-brand-black bg-[#f0f0e3] px-1 py-0.5 text-[10px] text-brand-black"
                              >
                                <option value="self">You paid</option>
                                <option value="other">Someone else paid</option>
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                      {splitMode === "equal" && (
                        <input
                          disabled
                          value={equalShare > 0 ? equalShare.toFixed(2) : "0.00"}
                          className="w-full border-2 border-brand-black bg-neutral-100 px-3 py-2 font-mono text-body text-brand-black md:w-28"
                        />
                      )}
                      {splitMode === "fixed" && (
                        <input
                          disabled={participantPaid[index] ?? false}
                          value={participantAmounts[index] ?? ""}
                          onChange={(e) =>
                            setParticipantAmounts((prev) => {
                              const next = [...prev];
                              next[index] = e.target.value;
                              return next;
                            })
                          }
                          placeholder="0.00"
                          className="w-full border-2 border-brand-black bg-brand-bg px-3 py-2 font-mono text-body text-brand-black placeholder:text-brand-muted focus:bg-brand-yellow focus:shadow-brutal focus:-translate-x-px focus:-translate-y-px focus:outline-none md:w-28"
                        />
                      )}
                      {splitMode === "percentage" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center">
                            <input
                              disabled={participantPaid[index] ?? false}
                              value={participantPercentages[index] ?? ""}
                              onChange={(e) =>
                                setParticipantPercentages((prev) => {
                                  const next = [...prev];
                                  next[index] = e.target.value;
                                  return next;
                                })
                              }
                              placeholder="0"
                              className="w-20 border-2 border-brand-black bg-brand-bg px-3 py-2 font-mono text-body text-brand-black placeholder:text-brand-muted focus:bg-brand-yellow focus:shadow-brutal focus:-translate-x-px focus:-translate-y-px focus:outline-none"
                            />
                            <span className="ml-1 font-mono text-xs text-brand-black">%</span>
                          </div>
                          <span className="font-mono text-xs text-brand-black">
                            pays $
                            {(
                              previewInputAmountDisplay *
                              ((Number(participantPercentages[index] ?? "0") || 0) / 100)
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {splitMode === "shares" && (
                        <div className="flex flex-wrap items-center gap-1">
                          <input
                            disabled={participantPaid[index] ?? false}
                            value={participantShares[index] ?? ""}
                            onChange={(e) =>
                              setParticipantShares((prev) => {
                                const next = [...prev];
                                next[index] = e.target.value;
                                return next;
                              })
                            }
                            placeholder="1"
                            className="w-20 border-2 border-brand-black bg-brand-bg px-3 py-2 font-mono text-body text-brand-black placeholder:text-brand-muted focus:bg-brand-yellow focus:shadow-brutal focus:-translate-x-px focus:-translate-y-px focus:outline-none"
                          />
                          <span className="font-mono text-xs text-brand-black">
                            = ${perPersonPreviewValues[index]?.amount.toFixed(2) ?? "0.00"}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeParticipant(index)}
                        className="font-mono text-xl text-brand-red"
                        aria-label={`Remove ${entry}`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              {splitMode === "fixed" && (
                <p className="font-mono text-xs text-brand-muted">
                  ${totalAssignedDisplay} of $
                  {previewInputAmountDisplay.toFixed(2)} assigned
                </p>
              )}
              {splitMode === "percentage" && (
                <p className="font-mono text-xs text-brand-muted">
                  {(participantBpsSum / 100).toFixed(2)}% of 100% assigned
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="label-text text-brand-muted">
                Custom Reminder Message (optional)
              </span>
              <textarea
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                placeholder="Hey! Don't forget to pay your share"
                rows={3}
                className="w-full border-2 border-brand-black bg-brand-bg px-4 py-3 font-mono text-body text-brand-black placeholder:text-brand-muted focus:bg-brand-yellow focus:shadow-brutal focus:-translate-x-px focus:-translate-y-px focus:outline-none"
              />
            </div>

            <p className="text-sm leading-snug text-brand-ink md:text-body">
              {splitMode === "equal"
                ? `Each person pays: $${formatUsdc(equalAmountPerPersonBigInt)} • Fee per person: $${formatUsdc(
                    feePerPersonForEqual
                  )} • You receive: $${formatUsdc(totalCreatorReceives)} total`
                : `Total fees: $${formatUsdc(totalFees)} • You receive: $${formatUsdc(
                    totalCreatorReceives
                  )} total`}
            </p>

            {error && (
              <div className="border-2 border-brand-red bg-white p-3 font-mono text-xs text-brand-red">
                {error}
              </div>
            )}

            <Button
              variant="red"
              size="lg"
              className="min-h-[52px] w-full"
              onClick={onCreateBill}
              disabled={
                !isConnected ||
                !walletClient ||
                loading ||
                !contractConfigured ||
                !canSubmitByMode
              }
            >
              {loading
                ? "Creating..."
                : !contractConfigured
                  ? "Contract not configured"
                  : "Create Bill →"}
            </Button>
          </div>
        </Card>

        <Card className="w-full border-brand-black bg-[#05070a] p-0 text-brand-bg shadow-[6px_6px_0_#0A0A0A] lg:w-[340px] lg:shrink-0">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <p className="label-text text-white/40">/// Live Summary</p>
            <span className="border border-white/20 bg-white/10 px-2 py-1 font-mono text-[10px] uppercase text-brand-lime">
              Base Sepolia
            </span>
          </div>
          <div className="p-5">
            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
                Total Bill
              </p>
              <p className="font-grotesk text-5xl font-bold leading-none text-brand-lime">
                ${previewInputAmountDisplay.toFixed(2)}
              </p>
              <p className="font-mono text-[10px] uppercase text-white/35">USDC</p>
            </div>
            <div className="mb-4 h-px bg-white/10" />
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wide text-white/40">Already Settled</span>
                <span className="font-bold text-green-400">${settledAmountDisplay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wide text-white/40">Outstanding</span>
                <span className="font-bold text-red-300">${outstandingAmountDisplay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wide text-white/40">Participants</span>
                <span>{previewParticipantsCount} total</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wide text-white/40">Pending Payment</span>
                <span className="text-red-300">{unpaidCount} people</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wide text-white/40">Split Type</span>
                <span className="text-white/60">{uiSplitType === "fixed" ? "CUSTOM $" : uiSplitType === "percentage" ? "BY %" : uiSplitType === "shares" ? "BY SHARES" : "EQUAL"}</span>
              </div>
              {splitMode === "equal" && (
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-wide text-white/40">Fee Per Person</span>
                  <span className="text-white">${formatUsdc(feePerPersonForEqual)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wide text-white/40">
                  Total Fees (Platform)
                </span>
                <span className="text-white">${formatUsdc(totalFees)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wide text-white/40">
                  Total Creator Receives
                </span>
                <span className="text-green-400">${formatUsdc(totalCreatorReceives)}</span>
              </div>
              {splitUiMode === "advanced" && (
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-wide text-white/40">Paid By</span>
                  <span className="text-white/60">{paidByInput || "—"}</span>
                </div>
              )}
            </div>
            <div className="my-4 h-px bg-white/10" />
            <div className="border border-white/15">
              <div className="border-b border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
                Per Person
              </div>
              <div>
              {perPersonPreviewValues.length === 0 ? (
                  <p className="px-3 py-4 text-center font-mono text-xs text-white/30">
                    Add participants to see breakdown
                  </p>
              ) : (
                perPersonPreviewValues.map((row, index) => (
                  <div
                    key={`${row.label}-${index}-preview`}
                      className={`flex items-center justify-between border-b border-white/10 px-3 py-2 font-mono text-xs ${
                        row.paid ? "bg-green-400/10" : ""
                      }`}
                  >
                      <span className="max-w-[170px] truncate text-white/80">
                        {row.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span>
                          $
                          {(row.paid
                            ? expectedPerPersonAmounts[index] ?? 0
                            : row.amount
                          ).toFixed(2)}
                        </span>
                        <span
                          className={`border px-1.5 py-0.5 text-[9px] uppercase ${
                            row.paid
                              ? "border-green-400 text-green-400"
                              : "border-white/25 text-white/45"
                          }`}
                        >
                          {row.paid ? "Settled" : "Pending"}
                        </span>
                      </div>
                  </div>
                ))
              )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </LayoutShell>
  );
}
