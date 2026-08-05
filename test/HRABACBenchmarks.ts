import { expect } from "chai";
import hre from "hardhat"; 

describe("HRABACEducationalRegistry - Gas Benchmark O(1)", function () {
  let registry: any;
  let admin: any, inspector: any, employer: any, student1: any;
  let ethers: any; 

  beforeEach(async function () {
    // Initialize the dynamic network connection instance
    const connection = await hre.network.create();
    ethers = connection.ethers;

    // Fetch independent mock signers from the runtime provider context
    const signers = await ethers.getSigners();
    [admin, inspector, employer] = signers; 

    // Deploy the smart contract passing the root Administrator address as the constructor argument
    const RegistryFactory = await ethers.getContractFactory("HRABACEducationalRegistry");
    registry = await RegistryFactory.deploy(admin.address); 
    await registry.waitForDeployment();
    
    // Provision system operator roles to match structural trust parameters
    await registry.connect(admin).registerInspector(inspector.address);
    await registry.connect(inspector).registerEmployer(employer.address);
  });

  it("Should prove O(1) complexity by checking gas cost with increasing data volume", async function () {
    // Standard data scaling vectors used for complexity profiling
    const dataSizes = [1, 10, 50, 100, 200, 1000, 10000]; 
    let lastGasUsed: bigint | null = null;
    this.timeout(120000); // 2-minute safety window for execution benchmarking
    
    // Explicit 32-byte hashes definitions to isolate metadata evaluation from JS string padding anomalies
    const targetDiplomaHash = ethers.id("Target_Academic_Diploma_2026");
    
    // Safe manual buffer packing matching Solidity's abi.encodePacked bit pattern
    const packedSecretBytes = ethers.concat([
      ethers.toUtf8Bytes("John Doe"),
      ethers.toUtf8Bytes("004515XXXX")
    ]);
    const targetCitizenHash = ethers.keccak256(packedSecretBytes);
    
    const targetPayload = "Encrypted_University_Sofia_Computer_Science_Excellent_5.80";
    
    // Seed database with the correct mapped properties passing exactly 3 arguments
    await registry.connect(inspector).addDiploma(targetDiplomaHash, targetCitizenHash, targetPayload);

    console.log("\n--- START GAS BENCHMARK ---");

    let currentCount = 1; 

    // Execute state layout saturation loops to evaluate algorithmic immunity against data scaling
    for (let size of dataSizes) {
      const itemsToAdd = size - currentCount;

      for (let i = 0; i < itemsToAdd; i++) {
        const fakeDiplomaHash = ethers.id(`Fake_Diploma_Hash_${size}_${i}`); 
        const fakeCitizenHash = ethers.id(`Fake_Citizen_Hash_${size}_${i}`); 
        
        // Populate the ledger index mapping layer sequentially with isolated entries
        await registry.connect(inspector).addDiploma(fakeDiplomaHash, fakeCitizenHash, "Fake_Metadata_Payload");
        currentCount++;
      }

      // Execute a static view query invocation using getFunction syntax to verify path validity
      // This will now execute perfectly along the SUCCESS path with NO reverts
      const gasUsed: bigint = await registry
        .connect(employer)
        .getFunction("verifyAndFetchMetadata")
        .estimateGas(
          targetDiplomaHash, 
          targetCitizenHash
        );
      
      console.log(`Data Volume: ${size} diplomas in DB | Gas Used for verification: ${gasUsed.toString()} gas`);

      // Enforce the strict constant-time mathematical constraint to prove the delta is exactly 0
      if (lastGasUsed !== null) {
        expect(gasUsed).to.equal(lastGasUsed, "Gas footprint mutated! Code does not exhibit strict O(1) properties.");
      }
      lastGasUsed = gasUsed;
    }
    
    console.log("--- END GAS BENCHMARK ---\n");
    console.log(`📊 Empirical Proof: Since the gas delta is exactly 0 across all storage volumes, algorithmic complexity is strictly O(1).`);
  });
});
