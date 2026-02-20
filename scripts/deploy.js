const hre = require("hardhat");

async function main() {
  const BillSplitter = await hre.ethers.getContractFactory("BillSplitter");
  const contract = await BillSplitter.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("BillSplitter deployed to:", address);
  console.log("Chain ID:", chainId);
  console.log("\nAdd to src/lib/chains.ts CONTRACT_ADDRESSES:");
  console.log(`  [${chainId}]: "${address}",`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
