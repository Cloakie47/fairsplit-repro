# FairySplit — Architecture & Design Guide

**A bill-splitting dApp with on-chain settlement and optional confidential payments.**

This document explains the system in plain English, teaches concepts before code, and describes why we made each design choice. No prior coding experience assumed.

---

## 1. High-Level System Architecture

### What Problem Does FairySplit Solve?

When you split a bill with friends (dinner, rent, a trip), someone usually pays upfront. That person is left tracking who owes what. Traditional apps like Splitwise track this off-chain—you trust the app and the other people. FairySplit moves the **settlement** (actually paying) onto the blockchain, so:

- Nobody can fake having paid
- The rules (exact amounts, no partials) are enforced by code
- Optional: payments can be **confidential** (amount and receiver hidden from public view)

### The Big Picture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Browser)                              │
│  Next.js + React + Tailwind | Connect Wallet | Create Bill | Pay Bill        │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN (Base / ARC Testnet)                      │
│  BillSplitter.sol — stores bills, tracks who paid, enforces exact amounts    │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         ▼                               ▼                               ▼
┌─────────────────┐           ┌─────────────────────┐         ┌─────────────────────┐
│  NORMAL PAYMENT │           │ CONFIDENTIAL PAYMENT│         │    PROFILE DATA      │
│  Direct on-chain│           │ @fairblock/stabletrust│       │  Off-chain DB or    │
│  Amount visible │           │ Amount + receiver   │         │  Decentralized      │
│                 │           │ hidden onchain      │         │  storage            │
└─────────────────┘           └─────────────────────┘         └─────────────────────┘
```

### Why Separate These Layers?

- **Blockchain** = source of truth for money and settlement
- **Frontend** = human-readable interface
- **Off-chain storage** = profiles, display names, optional email for reminders (we don’t put this on-chain because it’s not needed for correctness and would cost gas)
- **Confidential layer** = Fairblock’s StableTrust SDK handles hiding amount and receiver

---

## 2. UI/UX Walkthrough (Before Code)

We design the screens first so the implementation has a clear target.

### Design Principles

- **Minimal** — no unnecessary features
- **Calm** — neutral colors (slate, gray, off-white), no flashy effects
- **Professional** — fintech feel, not “crypto” style
- **Mobile-friendly** — readable on phones and tablets

### Screen Flow

#### 1. Connect Wallet

- Single button: “Connect Wallet”
- When connected: show truncated address (e.g. `0x1234...5678`)
- User’s wallet = their identity (no usernames or passwords)

#### 2. Create Bill

- Fields: Bill ID (short label), list of participant addresses, amount owed per participant
- Creator’s address is recorded automatically
- After creation → redirect to Bill Details

#### 3. Bill Details

- List of participants with status:
  - **Unpaid**
  - **Paid (Normal)** — amount visible
  - **Paid (Confidential)** — amount hidden
- Clear, simple layout

#### 4. Payment Screen

- Participant selects: Normal or Confidential
- Single “Pay” button
- Exact amount is enforced; paying less or more is rejected

### Status Indicators (Conceptual)

| Status        | Meaning                          |
|---------------|----------------------------------|
| Unpaid        | Participant has not settled      |
| Paid (Normal) | Public on-chain payment          |
| Paid (Confidential) | Amount and receiver hidden on public chain |

---

## 3. File-by-File Project Structure

```
FairySplit/
├── docs/
│   ├── ARCHITECTURE.md          # This file
│   ├── CONTRACT_EXPLAINED.md    # Line-by-line Solidity explanation
│   ├── FRONTEND_INTEGRATION.md  # How frontend talks to the contract
│   ├── CONFIDENTIALITY.md       # Fairblock/StableTrust integration
│   └── LEARNING_CHECKLIST.md    # Beginner learning path
├── contracts/
│   └── BillSplitter.sol         # Main smart contract
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Connect wallet, list bills
│   │   ├── create-bill/
│   │   │   └── page.tsx
│   │   ├── bill/[id]/
│   │   │   └── page.tsx         # Bill details
│   │   └── pay/[id]/
│   │       └── page.tsx         # Pay screen
│   ├── components/
│   │   ├── WalletConnect.tsx
│   │   ├── BillCard.tsx
│   │   ├── ParticipantList.tsx
│   │   └── PaymentForm.tsx
│   ├── lib/
│   │   ├── contract.ts          # Contract ABI, address, read/write
│   │   ├── chains.ts            # Base + ARC testnet config
│   │   └── stabletrust.ts       # Fairblock placeholders
│   └── hooks/
│       └── useBills.ts
├── package.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

---

## 4. Data Storage Rules

### On-Chain (Blockchain)

- Bills: ID, creator, participants, amount per participant
- Payment status: paid or not, payment mode (Normal / Confidential)
- **Not stored on-chain**: display names, emails, profile data

### Off-Chain

- User profiles: wallet, displayName, optional email, email reminders opt-in
- Profiles are created on first wallet connect (modal prompts for optional fields)
- **Demo**: localStorage (browser only, per device)

### Storage Options for Production

| Option | Pros | Cons | Best for |
|--------|------|------|----------|
| **Supabase** | Free tier, SQL, auth | Centralized | Quick backend, beginner-safe |
| **Firebase** | Free tier, real-time | Google lock-in | Fast prototyping |
| **IPFS / Filebase** | Decentralized | Read/write more complex | Censorship resistance |
| **localStorage** | No backend, instant | Per device, no sync | Demo, single-user |

**Recommendation:** Start with Supabase (free) for profiles + email reminders. Migrate to IPFS later if you need decentralization.

### Why Not Put Profiles On-Chain?

- Gas costs for storing strings
- Profile changes would require transactions
- Profiles are for UX, not for settlement logic

---

## 5. Email Reminders (Optional)

- Off-chain backend listens for `BillCreated` / `BillPaid` events
- Users can opt in to email reminders
- **Privacy rule**: if a payment is confidential, emails must **not** include amount or recipient; only say “You have a confidential payment request”

---

## 6. Payments — USDC Only

All payments are in **USDC** (6 decimals). No ETH/native payments.

- Base Sepolia USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- ARC Testnet USDC: `0x3600000000000000000000000000000000000000`

Participants must approve the BillSplitter contract to spend their USDC before paying.

## 7. Bill Name, Description & Custom Reminder

- **Name** — Required. Used to identify the split and derive the bill ID.
- **Description** — Optional. Shown on the bill detail page.
- **Custom email reminder** — Optional. Message included when sending reminder emails. Emitted in `BillCreated` for off-chain backends.

## 8. Chain Support & Theming

| Chain         | Chain ID | RPC (example)                  | Theme    |
|---------------|----------|--------------------------------|----------|
| Base Testnet  | 84532    | https://sepolia.base.org       | Blue     |
| ARC Testnet   | 5042002  | https://rpc.testnet.arc.network| Orange   |

The same contract is deployed on both chains. The frontend switches themes when the user changes network: Base shows a blue gradient, Arc shows an orange gradient.

---

*Next: See `CONTRACT_EXPLAINED.md` for line-by-line Solidity, and `CONFIDENTIALITY.md` for Fairblock integration.*
