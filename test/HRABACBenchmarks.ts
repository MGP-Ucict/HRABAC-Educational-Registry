import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "ethers";

describe("Gas Benchmark O(1)", function () {
  let registry: any;
  let admin: any, inspector: any, employer: any, student1: any;
  let node1: any, node2: any, node3: any;

  beforeEach(async function () {
    // 1. Explicitly initialize the dynamic network connection required by Hardhat 3
    const networkConnection = await hre.network.create();
    
    // 2. Extract the local network-bound ethers helper context
    const ethersHelper = networkConnection.ethers;

    // 3. Extracting mock test accounts from the contextual network provider
    const signers = await ethersHelper.getSigners();
    admin = signers[0];
    inspector = signers[1];
    employer = signers[2];
    student1 = signers[3];
    
    // Extract separate independent accounts for the multi-sig consortium nodes
    node1 = signers[4];
    node2 = signers[5];
    node3 = signers[6];

    // Define sorted consortium addresses and the threshold signature parameters
    const consensusNodes = [...[node1.address, node2.address, node3.address]].sort();
    const requiredSignatures = 2;

    // 4. Deploying the HRABAC contract instance via the correct multi-sig constructor matrix
    const RegistryFactory = await ethersHelper.getContractFactory("HRABACEducationalRegistry");
    registry = await RegistryFactory.deploy(admin.address, consensusNodes, requiredSignatures); 
    await registry.waitForDeployment();
    
    // 5. Initializing off-chain registry credentials and systemic trust parameters
    await registry.connect(admin).registerInspector(inspector.address, 50005);
    await registry.connect(inspector).registerEmployer(employer.address, 40004);
  });

  it("Should prove O(1) complexity by checking gas cost with \n\t increasing data volume", async function () {
    // Fix: Scaled down worst-case injection metrics to avoid local Hardhat EVM call timeout execution crashes
    const dataSizes = [1, 10, 50, 100, 200, 1000, 10000]; 
    let lastGasUsed: bigint | null = null;
    this.timeout(120000); // 2-minute timeout bound for storage transitions
    
    // Generating the REFERENCE CREDENTIAL to be systematically verified across all iterations.
    const targetStudentMcp = ethers.id("Target_Student_Static_MCP_Token");
    const targetHash = ethers.id("Target_Academic_Diploma_2026");
    
    // Committing the target entry into storage to serve as the baseline measurement
    await registry.connect(inspector).addDiploma(targetStudentMcp, targetHash);

    console.log("\n--- START GAS BENCHMARK ---");

    // Tracking the precise structural entries currently active in the blockchain storage mapping
    let currentCount = 1; 

    for (let size of dataSizes) {
      // Calculating the differential volume of dummy entries required to meet the current threshold size
      const itemsToAdd = size - currentCount;

      // Storage Inflation Loop: Artificially expanding the EVM mapping layout (mapping(bytes32 => bytes32))
      for (let i = 0; i < itemsToAdd; i++) {
        const fakeStudentMcp = ethers.id(`Fake_MCP_Token_${size}_${i}`); 
        const fakeHash = ethers.id(`Fake_Diploma_Hash_${size}_${i}`); 
        await registry.connect(inspector).addDiploma(fakeStudentMcp, fakeHash);
        currentCount++;
      }

      // CORE EMPIRICAL MEASUREMENT: Testing gas consumption using the correct fixed verifyDiplomaHRABAC function
      const gasUsed: bigint = await registry.connect(employer).verifyDiplomaHRABAC.estimateGas(targetStudentMcp, targetHash);
      
      console.log(`Data Volume: ${size} diplomas in DB | Gas Used for verification: ${gasUsed.toString()} gas`);

      // ACADEMIC ASSERTION FOR O(1) INVARIANCE
      // Verifying that computational gas overhead remains mathematically identical across variable storage scales
      if (lastGasUsed !== null) {
        expect(gasUsed).to.equal(lastGasUsed);
      }
      lastGasUsed = gasUsed;
    }
    
    console.log("--- END GAS BENCHMARK ---\n");
    console.log(`📊 Empirical Proof: Since the gas delta is exactly 0 across all storage \n\t volumes, algorithmic complexity is strictly O(1).`);
  });
});
