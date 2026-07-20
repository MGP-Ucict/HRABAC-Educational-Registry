import { expect } from "chai";
import hre  from "hardhat";
const { ethers } = await hre.network.create(); 

describe("Gas Benchmark O(1)", function () {
  let registry;
  let admin, inspector, employer, student1;

  beforeEach(async function () {
    // Extracting mock test accounts from the Hardhat network provider
    [admin, inspector, employer, student1] = await ethers.getSigners();

    // 1. Deploying the HRABAC contract instance (with inspector initialization)
    const RegistryFactory = await ethers.getContractFactory("HRABACEducationalRegistry");
    registry = await RegistryFactory.deploy(inspector.address);
    await registry.waitForDeployment();
    
    // Initializing off-chain registry credentials and systemic trust parameters
    await registry.connect(admin).registerInspector(inspector.address, 50005);
    await registry.connect(inspector).registerEmployer(employer.address, 40004);
  });

  it("Should prove O(1) complexity by checking gas cost with increasing data volume", async function () {
    // Defining data scale increments: 1, 10, 50, 100, 200, and 1000 diplomas inside state storage
    const dataSizes = [1, 10, 50, 100, 200, 1000, 10000]; 
    let lastGasUsed = null;
    this.timeout(120000); 
    // Generating the REFERENCE CREDENTIAL to be systematically verified across all iterations.
    // This credential remains anchored in the ledger from the initialization stage.
    const targetStudent = student1.address;
    const targetHash = ethers.id("Target_Academic_Diploma_2026");
    
    // Committing the target entry into storage to serve as the baseline measurement
    await registry.connect(inspector).addDiploma(targetStudent, targetHash);

    console.log("\n--- START GAS BENCHMARK ---");

    // Tracking the precise structural entries currently active in the blockchain storage mapping
    let currentCount = 1; 

    for (let size of dataSizes) {
      // 1. Calculating the differential volume of dummy entries required to meet the current threshold size
      const itemsToAdd = size - currentCount;

      // 2. Storage Inflation Loop: Artificially expanding the EVM storage mapping state
      for (let i = 0; i < itemsToAdd; i++) {
        const fakeStudentWallet = ethers.Wallet.createRandom(); 
        const fakeHash = ethers.id(`Fake_Diploma_ID_${size}_${i}`); 
        await registry.connect(inspector).addDiploma(fakeStudentWallet.address, fakeHash);
        currentCount++;
      }

      // 3. CORE EMPIRICAL MEASUREMENT: Triggering validation on the baseline target credential.
      // If verifyDiploma is a view function, we use estimateGas to isolate computational consumption.
      // Alternatively, if it modifies state or returns an external tx, we trigger full mutable execution.
      const gasUsed = await registry.connect(employer).verifyDiploma.estimateGas(targetStudent, targetHash);
      
      console.log(`Data Volume: ${size} diplomas in DB | Gas Used for verification: ${gasUsed.toString()} gas`);

      // 4. ACADEMIC ASSERTION FOR O(1) INVARIANCE
      // Verifying that computational gas overhead remains mathematically identical across variable storage scales
      if (lastGasUsed !== null) {
        expect(gasUsed).to.equal(lastGasUsed);
      }
      lastGasUsed = gasUsed;
    }
    
    console.log("--- END GAS BENCHMARK ---\n");
    console.log(`📊 Empirical Proof: Since the gas delta is exactly 0 across all storage volumes, algorithmic complexity is strictly O(1).`);
  });
});
