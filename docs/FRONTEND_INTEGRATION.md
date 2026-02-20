# Frontend ↔ Contract Interaction

This document explains how the FairySplit React/Next.js frontend talks to the BillSplitter smart contract.

---

## Prerequisites

- **ethers.js** (v6) — read from and send transactions to the contract
- **Wallet connection** — MetaMask, WalletConnect, etc. (e.g. via wagmi or RainbowKit)
- **Contract address** — deployed BillSplitter address (different per chain)

---

## Flow Overview

```
User Action          Frontend                    Blockchain
───────────────────────────────────────────────────────────────────
Connect wallet  →   wagmi/useAccount      →   Read address
Create bill     →   contract.createBill() →   Transaction, emit BillCreated
View bill       →   contract.getBill()    →   Read (no gas)
Pay (normal)    →   contract.payNormal()  →   Transaction + ETH, emit BillPaid
Pay (conf.)     →   StableTrust SDK       →   Confidential transfer
              →   markPaidConfidential()  →   Transaction (creator/relayer)
```

---

## Reading Data (View Calls)

View functions don’t change state and don’t cost gas when called from off-chain.

```javascript
// Get bill metadata
const [creator, amountPerParticipant, participants] = await contract.getBill(billId);

// Get payment status for a participant
const [paid, isConfidential, paidAt] = await contract.getParticipantStatus(billId, participantAddress);

// Check if address is a participant
const isPart = await contract.isParticipant(billId, address);

// List all bill IDs
const ids = await contract.getBillIds();
```

---

## Writing Data (Transactions)

Transactions change state and require a connected wallet and gas.

### Create Bill

```javascript
const billId = ethers.keccak256(ethers.toUtf8Bytes("dinner-2025-01")); // or any unique ID
const participants = ["0xABC...", "0xDEF..."];
const amountWei = ethers.parseEther("0.05"); // 0.05 ETH

const tx = await contract.createBill(billId, participants, amountWei);
await tx.wait(); // wait for confirmation
```

### Pay (Normal)

```javascript
const tx = await contract.payNormal(billId, {
  value: amountWei  // must match amountPerParticipant exactly
});
await tx.wait();
```

### Mark Paid (Confidential) — Placeholder

```javascript
// Only bill creator (or verifier) can call this
const tx = await contract.markPaidConfidential(billId, participantAddress);
await tx.wait();
```

---

## Listening for Events

The frontend can react to contract events (e.g. to update UI or trigger email logic).

```javascript
// BillCreated
contract.on("BillCreated", (billId, creator, participants, amountPerParticipant) => {
  // Refresh bill list
});

// BillPaid
contract.on("BillPaid", (billId, participant, isConfidential) => {
  // Update participant status
});
```

With ethers v6:

```javascript
const filter = contract.filters.BillPaid(billId);
contract.on(filter, (participant, isConfidential) => {
  // ...
});
```

---

## Chain Switching

Users switch networks via their wallet. The frontend should:

1. Read the current chain (e.g. `chain?.id` from wagmi).
2. Use the correct contract address for that chain.
3. Prompt the user to switch to Base or ARC testnet if needed.

```javascript
const chainConfig = {
  84532: { name: "Base Sepolia", contract: "0x..." },
  5042002: { name: "ARC Testnet", contract: "0x..." },
};
```

---

## Error Handling

| Error             | Cause                            | What to show                  |
|-------------------|-----------------------------------|-------------------------------|
| "Exact amount required" | Wrong amount sent            | “Please pay exactly X ETH”    |
| "Already paid"    | Participant already settled       | “You have already paid”       |
| "Not a participant" | Address not in bill            | “You are not in this bill”    |
| "Bill does not exist" | Invalid billId              | “Bill not found”              |

---

## Summary

- Use **read** (view) functions for display.
- Use **write** (transaction) functions for create and pay.
- Listen to **events** for live updates.
- Use **chain-specific** contract addresses and handle wrong network/errors in the UI.
