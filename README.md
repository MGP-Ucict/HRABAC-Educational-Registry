------------------------------
## 🎓 HRABAC: A Privacy-Preserving and Scalability-Oriented Hybrid Access Control Registry

# This repository contains the official smart contract implementations, formal verification artifacts, and empirical gas benchmarking suites for the Deterministic Hybrid Role-Attribute Based Access Control (HRABAC) framework, as presented in the corresponding research paper.
The core architecture breaks the performance-privacy trade-off in decentralized identity management by decoupling access pipelines into off-chain zero-trust contextual wrappers and an on-chain key-value mapping ledger structure, locking evaluation costs to a strict constant-time complexity \(\mathcal{O}(1)\).
------------------------------
## 🏗️ Repository Architecture

```text
.
├── contracts/
│   ├── HRABACEducationalRegistry.sol # Proposed O(1) constant-time hybrid ledger core
│   ├── PureABAC.sol                  # Benchmark baseline: Attribute-Based Access Control [O(n)]
│   └── PureRiskBAC.sol               # Benchmark baseline: Risk-Based Access Control (Deadlock prone)
├── test/
│   ├── HRABACBenchmarks.ts           # Mass-scale stress-test up to 10,000 records (Proving O(1))
│   ├── RiskBACBenchmarks.ts          # Adaptive telemetry and SSTORE/SLOAD mechanics evaluator
│   ├── ABACBenchmarks.ts             # Scaling stress-test up to 1,000 records (Proving O(n))
│   └── Comparison.ts                 # Targeted attack simulation (Exploding O(n) past safe safety limits)
├── hardhat.config.js                 # EVM compilation configurations (Solc v0.8.20 + 200 optimization runs)
├── package.json                      # Project dependencies (Hardhat, Ethers.js, Chai, Mocha)
└── README.md                         # Repository orientation and replication manual
```
------------------------------
## ⚡ Quick Start & Installation## 1. Prerequisites

Ensure you have [Node.js (v18.x or higher)](https://nodejs.org/) and npm installed.
## 2. Clone and Dependency Setup

Clone this repository and install the development packages:

git clone https://github.com/MGP-Ucict/HRABAC-Educational-Registry.git
cd hrabac-registry
npm install

## 3. Compile Smart Contracts

Compile the Solidity code using the configured Hardhat compiler:

npx hardhat compile

------------------------------
## 📊 Running the Empirical Test & Security Suite

The test infrastructure is segmented into three standalone simulation targets designed to empirically validate the paper's core claims.

## 1. Execute proposed HRABAC O(1) Stress-Test

Validates the flat execution baseline of exactly 27,727 gas across database depths expanding exponentially from 1 to 10,000 live storage items.

npx hardhat test test/HRABACBenchmarks.ts

Expected Outcome: 1 passing (~1.5m) console confirmation showcasing uniform transaction price stability.

## 2. Execute RiskBAC Dynamic Tracking Benchmark

Measures the gas profile under variable behavioral and failure history inputs, logging dynamic metric updates.

npx hardhat test test/RiskBACBenchmarks.ts

## 3. Execute Critical Vulnerability & Block Gas Limit DoS Simulation

Injects 350 structural storage metrics to actively crash the PureABAC dynamic execution loops. This script tests the contract past the established micro-threshold boundary ($\tau_{\text{gas}} = 120,000$) to visually trigger software failures, while showing HRABAC immunity under identical strain.

npx hardhat test test/Comparison.ts

Expected Outcome: Controlled compilation assertion fault (expect.fail) explicitly proving PureABAC susceptibility to contract bricking.

## 4. PureABAC Algorithmic Decay Details

The ABAC benchmarking suite is engineered to document performance breakdowns caused by iterative storage traversals.

npx hardhat test test/ABACBenchmarks.ts

1. Worst-Case Setup: The target credential hash is pushed to the absolute end of the dynamic array, forcing the EVM loop to scan every single index to replicate an adversarial worst-case query.
2. Volume-Induced Price Explosion: Every single iteration triggers expensive SLOAD opcodes. The console logs will outline the explicit linear progression:
   - 1 Record   | 33,021 gas
   - 10 Records  | 54,369 gas
   - 100 Records | 267,849 gas
   - 1000 Records| 2,402,649 gas
3. Block Gas Limit Extrapolation: Projections confirm that scaling to a routine public volume (12,000 to 15,000 records) breaches the 30,000,000 Mainnet Block Gas Limit, triggering execution reverts and permanent contract bricking.

------------------------------
## 🔬 Core Empirical Results Summary

| Access Control Model | Algorithmic Complexity | Baseline Verification Cost | Cost at 10,000 Records | Critical Security Risk |
|---|---|---|---|---|
| PureABAC | $\mathcal{O}(n)$ | 33,821 gas | Execution Reverted | Block Gas Limit DoS / Bricking |
| PureRiskBAC | $\mathcal{O}(1)$ storage lookups | 38,272 gas | Not Evaluated (N/A) | False-Positive Operational Lockouts |
| Proposed HRABAC | Strict $\mathcal{O}(1)$ | 27,727 gas | 27,727 gas | None (Fully Immune) |

------------------------------


