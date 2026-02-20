import { ethers } from "ethers";
import { CONTRACT_ADDRESSES } from "./chains";

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
