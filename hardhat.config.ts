import { defineConfig } from "hardhat/config";
// Import the plugin definition object directly from the package
import toolboxPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default defineConfig({
  // FIX: Pass the imported plugin definition object instead of a raw string
  plugins: [
    toolboxPlugin
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
  
  // Explicitly mapping the test environment directories for the Mocha runner
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
