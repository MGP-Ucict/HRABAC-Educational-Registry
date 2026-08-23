import { defineConfig } from "hardhat/config";
// Hardhat 3 requires explicit plugin imports and configuration declaration
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default defineConfig({
  // FIX: Plugins must be explicitly passed in Hardhat 3
  plugins: [
    hardhatToolboxMochaEthers
  ],

  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 999999,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "u:"
          }
        }
      },
      evmVersion: "cancun"
    },
  },
  
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },

  networks: {
    hardhat: {
      type: "edr-simulated",
      blockGasLimit: 30000000,
    },
  },
});
