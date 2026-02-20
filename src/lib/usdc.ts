import { ethers } from "ethers";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

export function getUsdcContract(
  usdcAddress: string,
  signerOrProvider: ethers.Signer | ethers.Provider
) {
  return new ethers.Contract(usdcAddress, ERC20_ABI, signerOrProvider);
}

export async function approveUsdc(
  usdcAddress: string,
  spender: string,
  amount: bigint,
  signer: ethers.Signer
) {
  const usdc = getUsdcContract(usdcAddress, signer);
  const tx = await usdc.approve(spender, amount);
  await tx.wait();
}

export async function transferUsdc(
  usdcAddress: string,
  to: string,
  amount: bigint,
  signer: ethers.Signer
) {
  const usdc = getUsdcContract(usdcAddress, signer);
  const tx = await usdc.transfer(to, amount);
  await tx.wait();
}
