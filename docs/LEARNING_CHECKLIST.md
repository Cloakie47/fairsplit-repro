# FairySplit — Beginner Learning Checklist

Use this checklist to learn while building. Concepts are ordered from foundational to advanced.

---

## 1. Blockchain Basics

- [ ] **What is a blockchain?** — A shared, append-only ledger. No single party controls it.
- [ ] **What is a wallet?** — Holds your private key. Used to sign transactions and prove identity.
- [ ] **What is gas?** — Fee paid to run transactions. More computation = more gas.
- [ ] **What is a transaction?** — A signed message that changes on-chain state (e.g. send ETH, call a contract).

---

## 2. Smart Contracts

- [ ] **What is a smart contract?** — Code deployed on a blockchain. Runs as specified and can’t be changed after deployment.
- [ ] **Solidity** — The main language for Ethereum and EVM chains.
- [ ] **Deploy** — Uploading compiled bytecode to the chain and getting a contract address.
- [ ] **ABI** — Application Binary Interface; describes how to call the contract from outside.

---

## 3. BillSplitter Concepts

- [ ] **Struct** — Groups related data (e.g. `Bill`, `ParticipantStatus`).
- [ ] **Mapping** — Key-value store (`billId → Bill`).
- [ ] **Event** — Log emitted by the contract for off-chain apps to listen.
- [ ] **require()** — Reverts the transaction if the condition is false.
- [ ] **msg.sender** — Address of the caller.
- [ ] **USDC** — All payments in USDC (6 decimals); use `approve` + `transferFrom`.

---

## 4. Exact Payment Rule

- [ ] Why we reject partial payments — Prevents incomplete settlement.
- [ ] Why we reject overpayment — Avoids incorrect accounting and change handling.
- [ ] How the contract enforces it — `require(amount == amountPerParticipant)`.

---

## 5. Confidential Payments

- [ ] **What is confidentiality?** — Hiding amount and recipient on the public chain.
- [ ] **Fairblock / FairyRing** — Chain and tools for confidential execution.
- [ ] **@fairblock/stabletrust** — SDK for confidential transfers on EVM.
- [ ] **Placeholder** — `markPaidConfidential` still needs a verifier/relayer in production.

---

## 6. Frontend Basics

- [ ] **React** — UI library with components and state.
- [ ] **Next.js** — React framework with routing, SSR, and tooling.
- [ ] **ethers.js** — Connect to chains, read contracts, send transactions.
- [ ] **Wallet connection** — Connect user wallet and read address/chain.

---

## 7. Frontend ↔ Contract

- [ ] **Read** — Call view functions (no gas when called off-chain).
- [ ] **Write** — Send transactions to change state (requires gas).
- [ ] **Events** — Listen for `BillCreated` and `BillPaid` to update UI.
- [ ] **Errors** — Map revert reasons to user-friendly messages.

---

## 8. Chains and Networks

- [ ] **Base testnet** — Chain ID 84532.
- [ ] **ARC testnet** — Chain ID 5042002 (or 1244 depending on network).
- [ ] **Chain switching** — User switches in wallet; frontend uses the correct contract address.

---

## 9. Data Storage

- [ ] **On-chain** — Bills, amounts, payment status (needed for settlement).
- [ ] **Off-chain** — Profiles (displayName, optional email, email reminders opt-in). Demo uses localStorage; production can use Supabase, Firebase, or IPFS.

---

## 10. Next Steps

- [ ] Deploy BillSplitter to Base and ARC testnets.
- [ ] Build the Next.js UI (Connect, Create Bill, Bill Details, Pay).
- [ ] Test normal payments end-to-end.
- [ ] Integrate @fairblock/stabletrust for confidential payments when the verifier flow is available.
- [ ] Add optional off-chain profile storage and email reminders.

---

## Resources

- [Solidity Docs](https://docs.soliditylang.org/)
- [ethers.js Docs](https://docs.ethers.org/v6/)
- [Fairblock Docs](https://docs.fairblock.network/)
- [@fairblock/stabletrust](https://www.npmjs.com/package/@fairblock/stabletrust)
