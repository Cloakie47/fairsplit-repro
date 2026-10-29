import { ethers } from "ethers";
import { CONTRACTS, FAIRSPLIT_V2_ABI } from "@/config/contracts";
import { CONTRACT_ADDRESSES } from "./chains";

export { CONTRACTS };

const ERC20_MIN_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ABI = [
  "event BillCreated(bytes32 indexed billId, address indexed creator, string name, string description, string customReminderMessage, address[] participants, uint256 amountPerParticipant)",
  "event BillPaid(bytes32 indexed billId, address indexed participant, bool isConfidential)",
  "function createBill(bytes32 billId, string name, string description, string customReminderMessage, address usdcToken, address[] participants, uint256 amountPerParticipant)",
  "function payNormal(bytes32 billId)",
  "function markPaidConfidential(bytes32 billId, address participant)",
  "function getBill(bytes32 billId) view returns (address creator, address usdcToken, string name, string description, uint256 amountPerParticipant, address[] participants)",
  "function getParticipantStatus(bytes32 billId, address participant) view returns (bool paid, bool isConfidential, uint256 paidAt)",
  "function isParticipant(bytes32 billId, address addr) view returns (bool)",
  "function getBillIds() view returns (bytes32[])",
] as const;

export function getContract(
  signerOrProvider: ethers.Signer | ethers.Provider,
  chainId?: number
) {
  const addr =
    (chainId && CONTRACT_ADDRESSES[chainId]) ||
    Object.values(CONTRACT_ADDRESSES).find(Boolean) ||
    ethers.ZeroAddress;
  if (addr === ethers.ZeroAddress) {
    throw new Error(
      "Contract not deployed. Deploy BillSplitter and set CONTRACT_ADDRESSES."
    );
  }
  return new ethers.Contract(addr, ABI, signerOrProvider);
}

export function parseBillId(str: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(str));
}

export function getFairsplitV2Contract(
  signerOrProvider: any,
  chainId?: number
) {
  const address =
    chainId === 8453
      ? CONTRACTS.base.fairsplitV2
      : chainId === 5042002
        ? CONTRACTS.arcTestnet.fairsplitV2
        : chainId === 42431
          ? CONTRACTS.tempoTestnet.fairsplitV2
          : CONTRACTS.baseSepolia.fairsplitV2;
  return new ethers.Contract(address, FAIRSPLIT_V2_ABI, signerOrProvider);
}

export function getUsdcContract(
  signerOrProvider: any,
  chainId?: number
) {
  const address =
    chainId === 8453
      ? CONTRACTS.base.usdc
      : chainId === 5042002
        ? CONTRACTS.arcTestnet.usdc
        : chainId === 42431
          ? CONTRACTS.tempoTestnet.usdc
          : CONTRACTS.baseSepolia.usdc;
  return new ethers.Contract(address, ERC20_MIN_ABI, signerOrProvider);
}

export function calculateFee(amount: bigint): bigint {
  const TIER_THRESHOLD = BigInt(100_000_000);
  const TIER_ONE_RATE = BigInt(30);
  const TIER_TWO_RATE = BigInt(15);
  const MAX_FEE = BigInt(50_000_000);

  let fee: bigint;
  if (amount <= TIER_THRESHOLD) {
    fee = (amount * TIER_ONE_RATE) / BigInt(10_000);
  } else {
    const tierOneFee = (TIER_THRESHOLD * TIER_ONE_RATE) / BigInt(10_000);
    const tierTwoFee =
      ((amount - TIER_THRESHOLD) * TIER_TWO_RATE) / BigInt(10_000);
    fee = tierOneFee + tierTwoFee;
  }

  return fee > MAX_FEE ? MAX_FEE : fee;
}

export function formatUsdc(amount: bigint): string {
  return (Number(amount) / 1_000_000).toFixed(2);
}

export function parseUsdc(amount: string): bigint {
  return BigInt(Math.round(parseFloat(amount) * 1_000_000));
}
