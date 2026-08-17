## 🎓 HRABAC: A Privacy-Preserving and Scalability-Oriented Hybrid Access Control Registry

This repository contains the official smart contract implementations, formal verification artifacts, and empirical gas benchmarking suites for the Deterministic Hybrid Role-Attribute Based Access Control (HRABAC) framework, as presented in the corresponding research paper.
The core architecture breaks the performance-privacy trade-off in decentralized identity management by decoupling access pipelines into off-chain zero-trust contextual wrappers and an on-chain key-value mapping ledger structure, locking evaluation costs to a strict constant-time complexity O(1).

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
│   ├── ABACBenchmarks.ts             # Stress-test up to 1,000 records (Proving O(n))
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

```shell
git clone https://github.com/MGP-Ucict/HRABAC-Educational-Registry.git
cd HRABAC-Educational-Registry

npm install
```

## 3. Compile Smart Contracts

Compile the Solidity code using the configured Hardhat compiler:

```shell
npx hardhat compile
```

------------------------------
## 📊 Running the Empirical Test & Security Suite

The test infrastructure is segmented into three standalone simulation targets designed to empirically validate the paper's core claims.

## 1. Execute proposed HRABAC O(1) Stress-Test

Validates the flat execution baseline of exactly 38,820 gas across database depths expanding exponentially from 1 to 10,000 live storage items.

```shell
npx hardhat test test/HRABACBenchmarks.ts
```

Expected Outcome: 1 passing console confirmation showcasing uniform transaction price stability.

## 2. Execute RiskBAC Dynamic Tracking Benchmark

Measures the gas profile under variable behavioral and failure history inputs, logging dynamic metric updates.

```shell
npx hardhat test test/RiskBACBenchmarks.ts
```

## 3. Execute Critical Vulnerability & Block Gas Limit DoS Simulation

Injects 350 structural storage metrics to actively crash the PureABAC dynamic execution loops. This script tests the contract past the established micro-threshold boundary ($\tau_{\text{gas}} = 120,000$) to visually trigger software failures, while showing HRABAC immunity under identical strain.

```shell
npx hardhat test test/Comparison.ts
```

Expected Outcome: Controlled compilation assertion fault (expect.fail) explicitly proving PureABAC susceptibility to contract bricking.

## 4. PureABAC Algorithmic Decay Details

The ABAC benchmarking suite is engineered to document performance breakdowns caused by iterative storage traversals.

```shell
npx hardhat test test/ABACBenchmarks.ts
```

1. Worst-Case Setup: The target credential hash is pushed to the absolute end of the dynamic array, forcing the EVM loop to scan every single index to replicate an adversarial worst-case query.
2. Volume-Induced Price Explosion: Every single iteration triggers expensive SLOAD opcodes. The console logs will outline the explicit linear progression:
   - 1 Record    | 45,342 gas
   - 10 Records  | 87,508 gas
   - 100 Records | 310,168 gas
   - 1000 Records| 2,536,756 gas
3. Block Gas Limit Extrapolation: Projections confirm that scaling to a routine public volume (12,000 to 15,000 records) breaches the 30,000,000 Mainnet Block Gas Limit, triggering execution reverts and permanent contract bricking.

------------------------------
## 🔬 Core Empirical Results Summary

| Access Control Model | Algorithmic Complexity | Baseline Verification Cost | Cost at 1000 Records | Critical Security Risk |
|---|---|---|---|---|
| PureABAC | $\mathcal{O}(n)$ | 45,342 gas | 2,536,756 gas| Block Gas Limit DoS / Bricking |
| PureRiskBAC | $\mathcal{O}(1)$ storage lookups | 44,273 gas | Not Evaluated (N/A) | False-Positive Operational Lockouts |
| Proposed HRABAC | Strict $\mathcal{O}(1)$ | 38,820 gas | 38,820 gas | None (Fully Immune) |

------------------------------


