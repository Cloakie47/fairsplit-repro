require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
  },
  networks: {
    baseSepolia: {
      url: "https://base-sepolia.g.alchemy.com/v2/nzAdWedaD3TXNXy2qDigY",
      chainId: 84532,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    arcTestnet: {
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
