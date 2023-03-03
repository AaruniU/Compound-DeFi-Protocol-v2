require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");

module.exports = {
  solidity: {
    compilers: [
        {
            version: "0.8.8"
        }
    ]
},
  networks: {
    hardhat:  {
      forking:  {
        enabled: true,
        url: "<your alchemy url>",
        blockNumber: 16427933
      }
    },
    goerli: {
      enabled: false,
      url: "<your goerli url>",
      accounts: ["<private key>"]
    }
  },
  etherscan: {
    apiKey: "<your etherscan api key>"
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 100000000
  }
}
