# Confidential Payments — Fairblock Integration

This document explains how FairySplit integrates with **Fairblock’s confidentiality model** and the [@fairblock/stabletrust](https://www.npmjs.com/package/@fairblock/stabletrust) SDK.

---

## Why Confidential Payments?

By default, blockchain transactions are public. Anyone can see:

- Who sent money
- Who received it
- How much

For bills between friends or colleagues, that may be unwanted. Confidential payments hide:

- The amount
- The recipient

On public explorers, the transaction looks like a generic contract call, not a specific payment.

---

## Fairblock / FairyRing Overview

[Fairblock](https://github.com/Fairblock) provides confidential computing for blockchains:

- **FairyRing** — their chain that runs confidential logic (homomorphic encryption, ZK proofs)
- **StableTrust** — a pre-built interface and SDK for confidential transfers on EVM chains
- **@fairblock/stabletrust** — npm package that wraps deposit, transfer, withdraw, and balance logic

The technical overview describes:

> Confidentiality is achieved by offloading privacy-sensitive logic to FairyRing, while settlement and liquidity remain on the originating EVM chain.

So users interact only with the EVM chain; the SDK and FairyRing handle the privacy layer.

---

## @fairblock/stabletrust SDK

Install:

```bash
npm install @fairblock/stabletrust
```

### Relevant Contract Addresses (Testnet)

| Network      | Chain ID | Contract Address                             |
|-------------|----------|----------------------------------------------|
| Base        | 84532    | `0x73D2bc5B5c7aF5C3726E7bEf0BD8b4931923fdA9` |
| Arc         | 1244     | `0x1Bf79BF5A32D6f3cdce3fe1A93c3fB222Bc93bb3` |
| Ethereum Sepolia | 11155111 | `0xD765Dff7D734ABE09f88991A46BAb73ACa8910EF` |

(Check [StableTrust docs](https://docs.fairblock.network/docs/confidential_transfers/stabletrust) for the latest addresses.)

### Main API

```javascript
import { ConfidentialTransferClient } from "@fairblock/stabletrust";
import { ethers } from "ethers";

// Init (example for Base testnet)
const client = new ConfidentialTransferClient(
  "https://sepolia.base.org",
  "0x73D2bc5B5c7aF5C3726E7bEf0BD8b4931923fdA9",
  84532
);

// Ensure account exists (required before transfers)
await client.ensureAccount(signer);

// Confidential transfer — amount and recipient hidden on public chain
const amount = ethers.parseUnits("10.50", 2); // x100 scale
await client.confidentialTransfer(
  signer,
  recipientAddress,
  tokenAddress,
  amount
);
```

- Amounts use **x100** scaling (2 decimals): `0.1` → `10`, display = raw / 100
- `ensureAccount()` creates/loads confidential keys on first use
- `confidentialTransfer()` moves funds confidentially; amount and recipient are not visible in plain form on the public chain

---

## PLACEHOLDER: How FairySplit Uses Confidential Payments

Our BillSplitter contract does **not** implement StableTrust directly. Instead:

1. **Normal payment** — User sends exact ETH to `payNormal(billId)`; contract forwards to creator.
2. **Confidential payment** — User pays via StableTrust; our contract marks them as paid only after verification.

The missing piece: **how does BillSplitter know a confidential payment was correct?**

### Conceptual Flow (Placeholder)

1. User selects “Confidential” in the UI.
2. Frontend calls `@fairblock/stabletrust` `confidentialTransfer(signer, billCreator, tokenAddress, amount)`.
3. StableTrust/FairyRing validates the transfer (ZK proofs, homomorphic checks).
4. On success, we need BillSplitter to mark the participant as paid.

**Options (placeholders):**

- **A) Verifier contract**  
  A separate contract (or module) trusted by BillSplitter receives a proof or attestation from FairyRing and calls `markPaidConfidential(billId, participant)`.

- **B) Relayer / IBC**  
  FairyRing emits an event or sends an IBC message; a relayer or bridge contract translates that into a call to `markPaidConfidential`.

- **C) Simplified demo**  
  Bill creator (or a trusted backend) calls `markPaidConfidential` after they receive the confidential transfer and confirm it off-chain. This is a demo shortcut, not trustless.

### Current Implementation

`markPaidConfidential` is callable by the **bill creator only**, as a simplified placeholder. In production, it should be restricted to a Fairblock verifier/relayer contract.

---

## Frontend Placeholder

```javascript
// src/lib/stabletrust.ts — PLACEHOLDER

import { ConfidentialTransferClient } from "@fairblock/stabletrust";

const STABLETRUST_ADDRESSES: Record<number, string> = {
  84532: "0x73D2bc5B5c7aF5C3726E7bEf0BD8b4931923fdA9",  // Base testnet
  1244: "0x1Bf79BF5A32D6f3cdce3fe1A93c3fB222Bc93bb3",   // Arc
};

export async function performConfidentialPayment(
  signer: ethers.Signer,
  recipient: string,
  tokenAddress: string,
  amountWei: bigint,
  chainId: number
) {
  const rpc = chainId === 84532
    ? "https://sepolia.base.org"
    : "https://rpc.testnet.arc.network";
  const contractAddr = STABLETRUST_ADDRESSES[chainId];
  if (!contractAddr) throw new Error("Unsupported chain");

  const client = new ConfidentialTransferClient(rpc, contractAddr, chainId);
  await client.ensureAccount(signer);

  // Amount in x100 units
  const amountX100 = amountWei / BigInt(1e16); // adjust per token decimals
  await client.confidentialTransfer(
    signer,
    recipient,
    tokenAddress,
    amountX100
  );

  // PLACEHOLDER: After transfer, caller or relayer must invoke
  // billSplitter.markPaidConfidential(billId, participant)
  // once Fairblock verification confirms the transfer.
}
```

---

## Summary

| Item        | Status      | Notes                                                  |
|------------|-------------|--------------------------------------------------------|
| Normal payment | Implemented | Direct ETH via `payNormal`                             |
| Confidential transfer | SDK ready  | Use `@fairblock/stabletrust` `confidentialTransfer`    |
| Mark paid (confidential) | Placeholder | Need verifier/relayer or demo flow                    |
| Exact amount check | In StableTrust | Enforced in FairyRing; our contract trusts verifier |

For full integration, Fairblock’s docs and relay/verifier setup are needed to bridge FairyRing verification to `markPaidConfidential`.
