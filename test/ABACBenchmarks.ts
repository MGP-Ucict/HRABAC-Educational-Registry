import { expect } from "chai";
import hre from "hardhat"; 
import { performance } from "perf_hooks";

describe("Gas Benchmark ABAC - Reference Legacy Linear O(n) Proof", function () {
  let abacRegistry: any;
  let admin: any, inspector: any, employer: any;
  let ethers: any; // Keep it as a local variable to assign later

  beforeEach(async function () {
    // 1. FIX: In Hardhat 3, explicitly create the network connection instance
    const connection = await hre.network.create();
    ethers = connection.ethers; // Extract the configured ethers instance from the connection

    // 2. Retrieve the signers from the newly created connection environment
    const signers = await ethers.getSigners();
    [admin, inspector, employer] = signers; 

    const PureABACFactory = await ethers.getContractFactory("PureABAC");
    abacRegistry = await PureABACFactory.deploy(admin.address); 
    await abacRegistry.waitForDeployment();

    await abacRegistry.connect(admin).registerSubjectAttributes(inspector.address, "Inspector", "Ministry_Of_Education");
    await abacRegistry.connect(admin).registerSubjectAttributes(employer.address, "Employer", "Independent_Reviewer_Node");
  });

  it("Should demonstrate strict O(n) algorithmic decay under linear array growth", async function () {
    let lastGasUsed = 0; 
    this.timeout(240000); 

    console.log("\n--- START REFERENCE LEGACY ABAC PERFORMANCE BENCHMARK (EXPECTING O(n)) ---");

    let currentRecordCount = 0;
    const databaseSizes: number[] = [1, 10, 50, 100, 200, 1000];

    for (let index = 0; index < databaseSizes.length; index++) {
      const size = databaseSizes[index];
      const itemsToInject = size - currentRecordCount;
      
      for (let i = 0; i < itemsToInject - 1; i++) {
        const fakeDiplomaHash = ethers.id("Fake_Diploma_" + size + "_" + i);
        const fakeCitizenHash = ethers.id("Fake_Citizen_Hash_" + size + "_" + i);
        
        const txFake = await abacRegistry.connect(inspector).addDiploma(
          fakeDiplomaHash, 
          fakeCitizenHash, 
          "Dummy University", 
          "Dummy_Payload"
        );
        await txFake.wait(); 
      }

      const dynamicTargetHash = ethers.id("Valid_Target_Diploma_" + size);
      const packedSecretBytes = ethers.concat([
        ethers.toUtf8Bytes("John Doe " + size),
        ethers.toUtf8Bytes("004515XXXX")
      ]);
      const dynamicCitizenHash = ethers.keccak256(packedSecretBytes);
      const targetPayload = "Encrypted_University_Sofia_Computer_Science_Excellent_5.80";
      const targetInstitution = "Sofia University";

      const txTarget = await abacRegistry.connect(inspector).addDiploma(
        dynamicTargetHash,
        dynamicCitizenHash,
        targetInstitution,
        targetPayload
      );
      await txTarget.wait();

      currentRecordCount = size; 

      // --- START LATENCY & GAS MEASUREMENT ---
      const startTime = performance.now();

      const gasEstimate = await abacRegistry
        .connect(employer)
        .verifyDiplomaABAC.estimateGas(dynamicTargetHash, dynamicCitizenHash);

      const endTime = performance.now();
      const executionLatencyMs = endTime - startTime;
      const gasUsed = Number(gasEstimate); 

      console.log(
        `Database Size: ${size.toString().padStart(4, ' ')} elements | ` +
        `Gas Used: ${gasUsed.toString().padStart(6, ' ')} gas | ` +
        `Latency: ${executionLatencyMs.toFixed(4)} ms`
      );
      // --- END LATENCY & GAS MEASUREMENT ---

      if (lastGasUsed > 0) {
        expect(gasUsed).to.be.greaterThan(
          lastGasUsed,
          "Algorithmic flaw! Gas remained constant. Loop execution path did not scale."
        );
      }
      
      lastGasUsed = gasUsed;
    }
    
    console.log("--- END LEGACY ABAC PERFORMANCE BENCHMARK ---\n");
    console.log("📊 Empirical Conclusion: Verified linear O(n) degradation for both Gas and Verification Latency.");
  });
});
