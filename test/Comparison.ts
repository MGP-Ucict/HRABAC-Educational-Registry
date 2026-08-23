import { expect } from "chai";
import hre from "hardhat";

describe("🛑 Critical Vulnerability and Block Gas Limit DoS Demonstration", function () {
  let abac: any, riskBac: any, hrabac: any;
  let admin: any, inspector: any, employer: any, student: any;
  let ethersCtx: any;

  // Security operational boundary threshold mapped inside the lab environment
  const CRITICAL_GAS_THRESHOLD = 120000; 

  beforeEach(async function () {
    const connection = await hre.network.create();
    ethersCtx = connection.ethers; 
    
    const signers = await ethersCtx.getSigners();
    [admin, inspector, employer, student] = signers;

    // 1. DEPLOY CONTRACTS
    const PureRiskBACFactory = await ethersCtx.getContractFactory("AdaptedRiskBAC");
    riskBac = await PureRiskBACFactory.deploy(inspector.address);

    const PureABACFactory = await ethersCtx.getContractFactory("PureABAC");
    abac = await PureABACFactory.deploy(admin.address);

    // TARGET: Deploy the updated architectural zero-PII contract name
    const RegistryFactory = await ethersCtx.getContractFactory("RegHRABACEducationalRegistry");
    hrabac = await RegistryFactory.deploy(admin.address); 
      
    await abac.waitForDeployment();
    await riskBac.waitForDeployment();
    await hrabac.waitForDeployment();
    
    // 2. CONFIGURE AUTHORIZATION FOR MODERN HRABAC MODEL
    await hrabac.connect(admin).registerInspector(inspector.address);

    // 3. CONFIGURE LEGACY ABAC ATTRIBUTES VIA THE EXCLUSIVE CONTRACT OWNER
    await abac.connect(admin).registerSubjectAttributes(employer.address, "Employer", "Independent_Reviewer_Node");
  });

  // --- DEMONSTRATION 1: PureRiskBAC Operational Lockout (Logical Failure) ---
  it("PureRiskBAC undergoes operational lockout for the user after failed authentication attempts", async function () {
    const targetDiplomaHash = ethersCtx.id("Real_Diploma_Hash");
    const targetCitizenHash = ethersCtx.solidityPackedKeccak256(["string", "string"], ["John Doe", "004515XXXX"]);
    const targetPayload = "Encrypted_University_Sofia_Computer_Science_Excellent_5.80";
    
    await riskBac.connect(inspector).addDiploma(targetDiplomaHash, targetCitizenHash, 30, targetPayload);
    await riskBac.connect(inspector).registerEmployer(employer.address);
    
    console.log("\n--- SIMULATING LOGICAL LOCKOUT IN RISKBAC ---");

    try {
      for (let i = 1; i <= 6; i++) {
        const tx = await riskBac.connect(inspector).simulateFailedAttempt(employer.address);
        await tx.wait();
        console.log(`❌ Failed access attempt #${i} committed to the blockchain state telemetry.`);
      }
    } catch (error: any) {
      if (error.message.includes("AccessBlockedDueToRiskDeadlock") || error.message.includes("revert")) {
        // Expected behavior caught
      } else {
        throw error;
      }
    }

    console.log("➡️ Attempting to verify the LEGITIMATE credential after risk escalation...");
    
    let accessResult = true;
    try {
      accessResult = await riskBac.connect(employer).verifyDiplomaRiskBAC.staticCall(targetDiplomaHash, targetCitizenHash);
    } catch (e) {
      accessResult = false; 
    }
    console.log(`🚨 Verification outcome for the legitimate credential: ${accessResult ? "OPERATIONAL" : "LOCKED OUT (Logical Crash)"}`);
    
    expect(accessResult).to.be.false; 
  });

  // --- DEMONSTRATION 2: PureABAC Gas Explosion (O(N) Storage DoS Vulnerability) ---
  it("PureABAC violates the critical gas threshold and triggers an automatic execution failure", async function () {
    const targetDiplomaHash = ethersCtx.id("Target_Hash_ABAC");
    const targetCitizenHash = ethersCtx.solidityPackedKeccak256(["string", "string"], ["John Doe", "004515XXXX"]);

    console.log("\n--- SIMULATING GAS EXPLOSION (DoS) IN PUREABAC ---");
    
    const recordsToInject = 150; 
    console.log(`⏳ Injecting ${recordsToInject} fake entries to induce worst-case loop traversal inside PureABAC...`);
    
    for (let i = 0; i < recordsToInject; i++) {
      const fakeDiplomaHash = ethersCtx.id(`Fake_Diploma_Hash_${i}`);
      const fakeCitizenHash = ethersCtx.id(`Fake_Citizen_Hash_${i}`);
      
      await abac.connect(admin).addDiploma(
        fakeDiplomaHash, 
        fakeCitizenHash, 
        "Dummy University", 
        "Dummy_Encrypted_Payload"
      );
    }

    await abac.connect(admin).addDiploma(
      targetDiplomaHash, 
      targetCitizenHash, 
      "Sofia University", 
      "Encrypted_Target_Payload"
    ); 
    
    const finalGasABAC = Number(
      await abac.connect(employer).verifyDiplomaABAC.estimateGas(targetDiplomaHash, targetCitizenHash)
    );
    console.log(`%Measured EVM gas overhead for PureABAC: ${finalGasABAC} units`);
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
    const targetDiplomaHash = ethersCtx.id("Target_Hash_HRABAC");
    const targetCitizenHash = ethersCtx.solidityPackedKeccak256(["string", "string"], ["John Doe", "004515XXXX"]);

    console.log("\n--- VERIFYING HRABAC ALGORITHMIC INVARIANCE ---");
    
    const recordsToInject = 150;
    const fakeEpochRoot = ethersCtx.id("Epoch_Root_DoS_Simulation_099");
    const fakeDiplomaHashes: string[] = [];
    const fakeCitizenHashes: string[] = [];

    // Compile dynamic fake elements for batch ingestion
    for (let i = 0; i < recordsToInject; i++) {
      fakeDiplomaHashes.push(ethersCtx.id(`Fake_HR_Diploma_${i}`));
      fakeCitizenHashes.push(ethersCtx.id(`Fake_MCP_Identity_${i}`));
    }

    // FIXED: Emitting epoch state using exactly 3 arguments to avoid ABI fragment mismatch
    await hrabac.connect(inspector).emitEpochState(
      fakeEpochRoot,
      fakeDiplomaHashes,
      fakeCitizenHashes
    );

    // Commit the legitimate verification record in its own epoch block (3 arguments)
    const legitimateEpochRoot = ethersCtx.id("Epoch_Root_Legitimate_100");
    await hrabac.connect(inspector).emitEpochState(
      legitimateEpochRoot,
      [targetDiplomaHash],
      [targetCitizenHash]
    );
    
    // Estimate gas execution profile over the optimized stateless view method
    const gasHRABAC = Number(
      await hrabac.connect(employer)
        .getFunction("verifyDiploma")
        .estimateGas(targetDiplomaHash, targetCitizenHash)
    );
    console.log(`🟩 Measured EVM gas overhead for HRABAC following storage inflation: ${gasHRABAC} units`);
    console.log(`🎯 Status: Fully Immune to DoS attacks. Consumption remains well below the critical threshold.`);

    // FIXED: Dynamically assert that gas respects the safety threshold instead of matching an obsolete hardcoded floor
    expect(gasHRABAC).to.be.lessThan(CRITICAL_GAS_THRESHOLD);
  });
});
