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
    // Defining data scale increments: 001, 10, 50, 100, 200, 1000, and 10000 diplomas inside state storage
    const dataSizes = [1, 10, 50, 100, 200, 1000, 10000]; 
    let lastGasUsed = null;
    this.timeout(240000); // Expanded timeout bound to accommodate intensive 10k EVM storage transitions
    
    // Generating the REFERENCE CREDENTIAL to be systematically verified across all iterations.
    // Transitioned from raw wallet address to a secure, static 32-byte MCP Address token.
    const targetStudentMcp = ethers.id("Target_Student_Static_MCP_Token");
    const targetHash = ethers.id("Target_Academic_Diploma_2026");
    
    // Committing the target entry into storage to serve as the baseline measurement
    await registry.connect(inspector).addDiploma(targetStudentMcp, targetHash);

    console.log("\n--- START GAS BENCHMARK ---");

    // Tracking the precise structural entries currently active in the blockchain storage mapping
    let currentCount = 1; 

    for (let size of dataSizes) {
      // 1. Calculating the differential volume of dummy entries required to meet the current threshold size
      const itemsToAdd = size - currentCount;

      // 2. Storage Inflation Loop: Artificially expanding the EVM mapping layout (mapping(bytes32 => bytes32))
      for (let i = 0; i < itemsToAdd; i++) {
        // Generating random keys under packed bytes32 representations to prevent enterprise address leakage
        const fakeStudentMcp = ethers.id(`Fake_MCP_Token_${size}_${i}`); 
        const fakeHash = ethers.id(`Fake_Diploma_Hash_${size}_${i}`); 
        await registry.connect(inspector).addDiploma(fakeStudentMcp, fakeHash);
        currentCount++;
      }

      // 3. CORE EMPIRICAL MEASUREMENT: Triggering validation on the baseline target credential.
      // Evaluates the updated verifyDiploma schema using the 32-byte MCP token logic wrapper.
      const gasUsed = await registry.connect(employer).verifyDiploma.estimateGas(targetStudentMcp, targetHash);
      
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
