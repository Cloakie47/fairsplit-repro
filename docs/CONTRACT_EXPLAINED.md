# BillSplitter.sol — Line-by-Line Explanation

This document explains the Solidity contract for complete beginners. Concepts are explained before code.

**Note:** The contract uses **USDC only** (no native ETH). All amounts are in USDC units (6 decimals).

---

## What is a Smart Contract?

A **smart contract** is code that runs on a blockchain. Once deployed, it cannot be changed. It executes exactly as written. In our case, the BillSplitter contract:

- Stores bills (name, description, who owes what)
- Tracks who has paid
- Enforces the **exact payment rule** (no partials, no overpay)
- Transfers USDC to the bill creator when someone pays normally

---

## Basic Solidity Concepts

### `pragma solidity ^0.8.20`

- Tells the compiler which Solidity version to use
- `^0.8.20` means “0.8.20 or higher, but less than 0.9.0”

### Events

- Events are stored on the blockchain and can be read by off-chain apps
- Used for: logging, notifications, and UI updates
- Cheaper than storing data in contract storage

### Structs

- A struct is a custom data type that groups related fields
- Like a record or object in other languages

### Mappings

- `mapping(key => value)` — like a dictionary or hash map
- Default value for a never-set key is zero/false/empty
- Cannot iterate over a mapping directly

---

## Line-by-Line Walkthrough

### Events

```solidity
event BillCreated(
    bytes32 indexed billId,
    address indexed creator,
    string name,
    string description,
    string customReminderMessage,
    address[] participants,
    uint256 amountPerParticipant
);
```

**WHY:** When a bill is created, we emit this event. The frontend listens for it to update the UI. `customReminderMessage` is used by off-chain email reminder backends. `indexed` makes the field searchable in logs.

```solidity
event BillPaid(
    bytes32 indexed billId,
    address indexed participant,
    bool isConfidential
);
```

**WHY:** When someone pays, we emit BillPaid. If the payment is confidential, we do *not* include the amount—that stays private. We only expose whether it was normal or confidential.

---

### Structs

```solidity
struct Bill {
    address creator;
    address usdcToken;
    string name;
    string description;
    uint256 amountPerParticipant;
    address[] participants;
    mapping(address => ParticipantStatus) participantStatus;
}
```

- `creator` — wallet that created the bill (who receives payments)
- `usdcToken` — USDC contract address for this chain
- `name` — human-readable name (required)
- `description` — optional details
- `amountPerParticipant` — exact USDC amount each participant must pay (6 decimals)
- `participants` — list of addresses who owe money
- `participantStatus` — for each address: paid? confidential? when?

```solidity
struct ParticipantStatus {
    bool paid;
    bool isConfidential;
    uint256 paidAt;
}
```

- `paid` — true if they’ve settled
- `isConfidential` — true if they used confidential payment
- `paidAt` — block timestamp when they paid (0 if unpaid)

---

### State Storage

```solidity
mapping(bytes32 => Bill) private bills;
bytes32[] private billIds;
```

- `bills` — maps bill ID → full Bill data
- `billIds` — list of all bill IDs (so we can enumerate bills)
- `private` — not callable from outside the contract (still visible on-chain)

---

### createBill

```solidity
function createBill(
    bytes32 billId,
    address[] calldata participants,
    uint256 amountPerParticipant
) external {
```

- `calldata` — read-only, cheap for arrays passed from outside
- `external` — callable only from outside the contract

```solidity
    require(billId != bytes32(0), "Invalid bill ID");
    require(participants.length > 0, "No participants");
    require(amountPerParticipant > 0, "Amount must be > 0");
```

- `require` — if false, the transaction reverts (no state changes, gas refunded except for used portion)

```solidity
    Bill storage b = bills[billId];
    require(b.creator == address(0), "Bill already exists");
```

- `storage` — reference to persistent storage (not a copy)
- If `creator` is `address(0)`, the bill slot is empty, so we can create it

The rest of `createBill` fills the struct, stores participants, and emits `BillCreated`.

---

### payNormal

```solidity
function payNormal(bytes32 billId) external {
    _pay(billId, msg.sender, false);
}
```

- No `payable` — we use USDC, not ETH. Participant must first `approve()` BillSplitter.
- `msg.sender` — caller’s address
- `false` — not a confidential payment

---

### _pay (internal logic)

```solidity
require(
    amount == b.amountPerParticipant,
    "Exact amount required"
);
```

**Exact payment rule:** amount must equal `amountPerParticipant` exactly. Otherwise, the transaction reverts.

```solidity
if (!isConfidential) {
    bool ok = IERC20(b.usdcToken).transferFrom(
        participant,
        b.creator,
        amount
    );
    require(ok, "USDC transfer failed");
}
```

- For normal payments, we transfer USDC from participant to bill creator
- Participant must have approved this contract to spend `amount`

---

### markPaidConfidential

```solidity
function markPaidConfidential(bytes32 billId, address participant) external {
```

**PLACEHOLDER:** In production, only a Fairblock/FairyRing verifier or trusted relayer should call this. Currently, the bill creator can call it for demo purposes. See `docs/CONFIDENTIALITY.md` for the full flow.

---

### View Functions

- `getBill` — returns creator, amount per participant, and participants
- `getParticipantStatus` — returns paid, isConfidential, paidAt for an address
- `getBillIds` — returns all bill IDs
- `isParticipant` — returns whether an address is in the bill’s participant list

These are `view` — they don’t modify state and don’t cost gas when called from off-chain (e.g. frontend).

---

## Summary

| Concept          | Purpose                                      |
|------------------|----------------------------------------------|
| Events           | Log and notify off-chain apps                |
| Structs          | Group related data (Bill, ParticipantStatus) |
| Mappings         | Look up bills and participant status         |
| require()        | Enforce rules and revert on failure          |
| msg.sender       | Identify who is calling                      |
| msg.value        | Amount of ETH sent                           |
| Exact payment    | Reject wrong amounts                         |
