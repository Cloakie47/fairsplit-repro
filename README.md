# FairySplit

A Splitwise-like bill-splitting dApp with on-chain settlement. Supports **normal** (public) and **confidential** payments via Fairblock. All payments in USDC.

---

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connect your wallet (MetaMask) and switch to **Base Sepolia** or **ARC Testnet**.

### 3. Deploy the contract (required for creating splits)

Create a `.env` file (copy from `.env.example`):

```
PRIVATE_KEY=your_wallet_private_key
```

Compile and deploy:

```bash
npm run compile
npm run deploy:base   # Base Sepolia
npm run deploy:arc    # ARC Testnet
```

Copy the deployed address into `src/lib/chains.ts`:

```ts
export const CONTRACT_ADDRESSES: Record<number, string> = {
  84532: "0xYourDeployedAddress",   // Base Sepolia
  5042002: "0xYourDeployedAddress", // ARC Testnet
};
```

### 4. Get testnet USDC

- **Base Sepolia**: [Circle Faucet](https://faucet.circle.com/)
- **ARC Testnet**: [Arc docs](https://docs.arc.network/arc/references/connect-to-arc)

---

## Project structure

```
FairySplit/
├── contracts/          # Solidity
│   └── BillSplitter.sol
├── src/
│   ├── app/            # Next.js pages
│   ├── components/
│   └── lib/            # Contract, chains, profile
├── docs/               # Architecture, contract explanation, learning checklist
├── scripts/
│   └── deploy.js
└── hardhat.config.js
```

---

## Requirements

- Node.js 18+
- MetaMask (or compatible wallet)
- Testnet USDC on Base Sepolia or ARC Testnet

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System overview, UI walkthrough, storage options |
| [CONTRACT_EXPLAINED.md](docs/CONTRACT_EXPLAINED.md) | Line-by-line Solidity |
| [FRONTEND_INTEGRATION.md](docs/FRONTEND_INTEGRATION.md) | Frontend ↔ contract |
| [CONFIDENTIALITY.md](docs/CONFIDENTIALITY.md) | Fairblock / confidential payments |
| [LEARNING_CHECKLIST.md](docs/LEARNING_CHECKLIST.md) | Beginner learning path |

---

## License

MIT
