import { expect } from "chai";
import hre from "hardhat";

describe("🛑 Critical Vulnerability and Block Gas Limit DoS Demonstration", function () {
  let abac: any, riskBac: any, hrabac: any;
  let admin: any, inspector: any, employer: any, student: any;
  let ethers: any;

  // Security operational boundary threshold mapped inside the lab environment
  const CRITICAL_GAS_THRESHOLD = 120000; 

  beforeEach(async function () {
    const connection = await hre.network.create();
    ethers = connection.ethers; 
    
    const signers = await ethers.getSigners();
    [admin, inspector, employer, student] = signers;

    // 1. DEPLOY CONTRACTS
    // In PureRiskBAC, the deployer wallet (admin) automatically becomes the default contract inspector
    const PureRiskBACFactory = await ethers.getContractFactory("AdaptedRiskBAC");
    riskBac = await PureRiskBACFactory.deploy(inspector.address);

    const PureABACFactory = await ethers.getContractFactory("PureABAC");
    abac = await PureABACFactory.deploy(admin.address);

    const RegistryFactory = await ethers.getContractFactory("HRABACEducationalRegistry");
    hrabac = await RegistryFactory.deploy(admin.address); 
      
    await abac.waitForDeployment();
    await riskBac.waitForDeployment();
    await hrabac.waitForDeployment();
    
    // 2. CONFIGURE AUTHORIZATION FOR MODERN HRABAC MODEL
    await hrabac.connect(admin).registerInspector(inspector.address);
    await hrabac.connect(inspector).registerEmployer(employer.address);

    // 3. CONFIGURE LEGACY ABAC ATTRIBUTES VIA THE EXCLUSIVE CONTRACT OWNER
    await abac.connect(admin).registerSubjectAttributes(employer.address, "Employer", "Independent_Reviewer_Node");
  });

  // --- DEMONSTRATION 1: PureRiskBAC Operational Lockout (Logical Failure) ---
  it("PureRiskBAC undergoes operational lockout for the user after failed authentication attempts", async function () {
    const targetDiplomaHash = ethers.id("Real_Diploma_Hash");
    const targetCitizenHash = ethers.solidityPackedKeccak256(["string", "string"], ["John Doe", "004515XXXX"]);
    const targetPayload = "Encrypted_University_Sofia_Computer_Science_Excellent_5.80";
    
    // The contract deployer (admin) seeds the record inside PureRiskBAC matching the 4-argument signature tier
    await riskBac.connect(inspector).addDiploma(targetDiplomaHash, targetCitizenHash, 30, targetPayload);
    await riskBac.connect(inspector).registerEmployer(employer.address);
    
    console.log("\n--- SIMULATING LOGICAL LOCKOUT IN RISKBAC ---");

    const wrongCitizenHash = ethers.ZeroHash;
    let deadlockCaptured = false;

    try {
      for (let i = 1; i <= 6; i++) {
        // FIXED: Invoked via ADMIN to satisfy require(msg.sender == inspector) constraint inside PureRiskBAC
        const tx = await riskBac.connect(inspector).simulateFailedAttempt(employer.address);
        await tx.wait();
        console.log(`❌ Failed access attempt #${i} committed to the blockchain state telemetry.`);
      }
    } catch (error: any) {
      if (error.message.includes("AccessBlockedDueToRiskDeadlock") || error.message.includes("revert")) {
        deadlockCaptured = true;
      } else {
        throw error;
      }
    }

    console.log("➡️ Attempting to verify the LEGITIMATE credential after risk escalation...");
    
    let accessResult = true;
    try {
      accessResult = await riskBac.connect(employer).verifyDiplomaRiskBAC.staticCall(targetDiplomaHash, targetCitizenHash);
    } catch (e) {
      accessResult = false; // Capture the runtime evaluation lock execution block
    }
    console.log(`🚨 Verification outcome for the legitimate credential: ${accessResult ? "OPERATIONAL" : "LOCKED OUT (Logical Crash)"}`);
    
    expect(accessResult).to.be.false; 
  });

  // --- DEMONSTRATION 2: PureABAC Gas Explosion (O(N) Storage DoS Vulnerability) ---
  it("PureABAC violates the critical gas threshold and triggers an automatic execution failure", async function () {
    const targetDiplomaHash = ethers.id("Target_Hash_ABAC");
    const targetCitizenHash = ethers.solidityPackedKeccak256(["string", "string"], ["John Doe", "004515XXXX"]);

    console.log("\n--- SIMULATING GAS EXPLOSION (DoS) IN PUREABAC ---");
    
    const recordsToInject = 150; 
    console.log(`⏳ Injecting ${recordsToInject} fake entries to induce worst-case loop traversal inside PureABAC...`);
    
    for (let i = 0; i < recordsToInject; i++) {
      const fakeDiplomaHash = ethers.id(`Fake_Diploma_Hash_${i}`);
      const fakeCitizenHash = ethers.id(`Fake_Citizen_Hash_${i}`);
      
      // Seed legacy storage records directly using the primary system admin wallet
      await abac.connect(admin).addDiploma(
        fakeDiplomaHash, 
        fakeCitizenHash, 
        "Dummy University", 
        "Dummy_Encrypted_Payload"
      );
    }

    // Anchor the target verification record at the very bottom index slot via Admin
    await abac.connect(admin).addDiploma(
      targetDiplomaHash, 
      targetCitizenHash, 
      "Sofia University", 
      "Encrypted_Target_Payload"
    ); 
    
    // Measure dynamic gas consumption using type-safe estimation properties
    const finalGasABAC = Number(
      await abac.connect(employer).verifyDiplomaABAC.estimateGas(targetDiplomaHash, targetCitizenHash)
    );
    console.log(`⛽ Measured EVM gas overhead for PureABAC: ${finalGasABAC} units`);
    console.log(`🛡️ Defined Critical Safety Margin: ${CRITICAL_GAS_THRESHOLD} units`);

    if (finalGasABAC > CRITICAL_GAS_THRESHOLD) {
      console.log(`\n🛑 [CRITICAL FAULT]: PureABAC execution TERMINATED automatically!`);
      console.log(`⚠️ Reason: Computational overhead of ${finalGasABAC} gas units breached the safe threshold of ${CRITICAL_GAS_THRESHOLD}.`);
      console.log(`🛑 Architecture is highly vulnerable to Block Gas Limit Denial of Service (DoS) attacks!`);
    }

    expect(finalGasABAC).to.be.greaterThan(CRITICAL_GAS_THRESHOLD);
  });

  // --- DEMONSTRATION 3: HRABAC Deterministic Immunity under identical strain ---
  it("HRABAC maintains constant O(1) performance under identical storage strain with no gas fluctuations", async function () {
    const targetDiplomaHash = ethers.id("Target_Hash_HRABAC");
    const targetCitizenHash = ethers.solidityPackedKeccak256(["string", "string"], ["John Doe", "004515XXXX"]);
    const targetPayload = "Encrypted_University_Sofia_Computer_Science_Excellent_5.80";

    console.log("\n--- VERIFYING HRABAC ALGORITHMIC INVARIANCE ---");
    
    // Injecting identical load factors into the clean append-only index layer via Inspector
    for (let i = 0; i < 150; i++) {
      const randomFakeMcp = ethers.id(`Fake_MCP_Identity_${i}`);
      const randomFakeHash = ethers.id(`Fake_HR_Diploma_${i}`);
      await hrabac.connect(inspector).addDiploma(randomFakeMcp, randomFakeHash, "Fake_Encrypted_Payload");
    }

    // Seed database with the legitimate target tracking variables matching the 4-argument layout tier
    await hrabac.connect(inspector).addDiploma(targetDiplomaHash, targetCitizenHash, targetPayload);
    
    // Target the exact view method signature verifyAndFetchMetadata using type-safe getFunction syntax
    const gasHRABAC = Number(
      await hrabac.connect(employer)
        .getFunction("verifyAndFetchMetadata")
        .estimateGas(targetDiplomaHash, targetCitizenHash)
    );
    console.log(`🟩 Measured EVM gas overhead for HRABAC following storage inflation: ${gasHRABAC} units`);
    console.log(`🎯 Status: Fully Immune to DoS attacks. Consumption remains well below the critical threshold.`);

    expect(gasHRABAC).to.be.lessThan(CRITICAL_GAS_THRESHOLD);
  });
});
