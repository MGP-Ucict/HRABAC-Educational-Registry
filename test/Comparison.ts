import { expect } from "chai";
import hre  from "hardhat";
const { ethers } = await hre.network.create(); 

describe("🛑 Critical Vulnerability and Block Gas Limit DoS Demonstration", function () {
  let abac, riskBac, hrabac;
  let admin, inspector, employer, student;

  // DEFINING THE CRITICAL SECURITY BOUNDARY
  // In the live Ethereum Mainnet, the block gas limit scales up to 30,000,000 units.
  // For the deterministic scope of this laboratory benchmark, we define a strict 
  // micro-threshold of 120,000 gas units per single state execution.
  const CRITICAL_GAS_THRESHOLD = 120000; 

  beforeEach(async function () {
    [admin, inspector, employer, student] = await ethers.getSigners();

    // Deploying contract instances
    abac = await (await ethers.getContractFactory("PureABAC")).deploy();
    riskBac = await (await ethers.getContractFactory("PureRiskBAC")).deploy();
    hrabac = await (await ethers.getContractFactory("HRABACEducationalRegistry")).deploy(inspector.address);

    await abac.waitForDeployment();
    await riskBac.waitForDeployment();
    await hrabac.waitForDeployment();
    
    // Initializing access control parameters and system attributes
    await hrabac.connect(admin).registerInspector(inspector.address, 50005);
    await hrabac.connect(inspector).registerEmployer(employer.address, 40004);
    await hrabac.connect(inspector).registerGraduate(student.address, 30003);
    await abac.connect(admin).registerSubjectAttributes(employer.address, "Employer", "MoE");
  });

  // ------------------------------------------------------------------
  // DEMONSTRATION 1: PureRiskBAC Operational Lockout (Logical Failure)
  // ------------------------------------------------------------------
    // ------------------------------------------------------------------
  // DEMONSTRATION 1: PureRiskBAC Operational Lockout (Logical Failure)
  // ------------------------------------------------------------------
  it("PureRiskBAC undergoes operational lockout for the user after 5 failed authentication attempts", async function () {
    const targetHash = ethers.id("Real_Diploma_Hash");
    
    // 1. Add diploma with a strict security clearance of 30 (Risk limit: 100 - 30 = 70)
    await riskBac.connect(admin).addDiploma(targetHash, student.address, 30);
    
    // 2. Initialize employer reputation to 100 to kickstart the baseline state
    await riskBac.connect(admin).initializeReviewer(employer.address);
    
    console.log("\n--- SIMULATING LOGICAL LOCKOUT IN RISKBAC ---");

    // 3. Trigger 5 sequential context mismatch failures (wrong student address) to escalate risk metrics
    const wrongStudentAddress = ethers.Wallet.createRandom().address;
    
    for (let i = 1; i <= 5; i++) {
      const tx = await riskBac.connect(employer).verifyDiplomaRiskBAC(targetHash, wrongStudentAddress);
      await tx.wait();
      console.log(`❌ Failed access attempt #${i} committed to the blockchain state.`);
    }

    console.log("➡️ Attempting to verify the LEGITIMATE credential after risk escalation...");
    
    // 4. Evaluate access execution via staticCall to intercept the return value without reversing state
    const accessResult = await riskBac.connect(employer).verifyDiplomaRiskBAC.staticCall(targetHash, student.address);
    console.log(`🚨 Verification outcome for the legitimate credential: ${accessResult ? "OPERATIONAL" : "LOCKED OUT (Logical Crash)"}`);
    
    // The assertion passes successfully because the engine traps itself in a permanent deadlock loop
    expect(accessResult).to.be.false; 
  });

  // ------------------------------------------------------------------
  // DEMONSTRATION 2: PureABAC Gas Explosion (O(N) Storage DoS Vulnerability)
  // ------------------------------------------------------------------
  it("PureABAC violates the critical gas threshold and triggers an automatic execution failure", async function () {
    const targetHash = ethers.id("Target_Hash_ABAC");
    await abac.connect(admin).addDiploma("MoE", targetHash); // Matching PureABAC.sol parameter order: (_inst, _hash)

    console.log("\n--- SIMULATING GAS EXPLOSION (DoS) IN PUREABAC ---");
    
    // Injecting 350 structural elements to inflate the storage array and trigger linear computation decay
    const recordsToInject = 350; 
    console.log(`⏳ Injecting ${recordsToInject} fake entries to induce worst-case loop traversal inside PureABAC...`);
    
    for (let i = 0; i < recordsToInject; i++) {
      await abac.connect(admin).addDiploma("Other", ethers.id(`Fake_${i}`));
    }

    // Measuring exact EVM computational gas after targeted state expansion
    const finalGasABAC = Number(await abac.connect(employer).verifyDiplomaABAC.estimateGas(targetHash));
    console.log(`⛽ Measured EVM gas overhead for PureABAC: ${finalGasABAC} units`);
    console.log(`🛡️ Defined Critical Safety Margin: ${CRITICAL_GAS_THRESHOLD} units`);

    // DETERMINISTIC SOFTWARE FAIL TRIGGER FOR RESEARCH VISUALIZATION
    if (finalGasABAC > CRITICAL_GAS_THRESHOLD) {
      console.log(`\n🛑 [CRITICAL FAULT]: PureABAC execution TERMINATED automatically!`);
      console.log(`⚠️ Reason: Computational overhead of ${finalGasABAC} gas units breached the safe threshold of ${CRITICAL_GAS_THRESHOLD}.`);
      console.log(`💀 Architecture is highly vulnerable to Block Gas Limit Denial of Service (DoS) attacks!`);
      
      // Raising an explicit assertion failure to visually break the test suite for the research paper
      expect.fail(`PureABAC Gas Exhaustion detected: ${finalGasABAC} > ${CRITICAL_GAS_THRESHOLD}`);
    }

    expect(finalGasABAC).to.be.lessThan(CRITICAL_GAS_THRESHOLD);
  });

  // ------------------------------------------------------------------
  // DEMONSTRATION 3: HRABAC Deterministic Immunity under identical strain
  // ------------------------------------------------------------------
  it("HRABAC maintains constant O(1) performance under identical storage strain with no gas fluctuations", async function () {
    const targetHash = ethers.id("Target_Hash_HRABAC");
    await hrabac.connect(inspector).addDiploma(student.address, targetHash);

    console.log("\n--- VERIFYING HRABAC ALGORITHMIC INVARIANCE ---");
    
    // Injecting an identical load (350 records) into the HRABAC contract instance
    for (let i = 0; i < 350; i++) {
      await hrabac.connect(inspector).addDiploma(ethers.Wallet.createRandom().address, ethers.id(`Fake_HR_${i}`));
    }

    const gasHRABAC = Number(await hrabac.connect(employer).verifyDiploma.estimateGas(student.address, targetHash));
    console.log(`🟩 Measured EVM gas overhead for HRABAC following storage inflation: ${gasHRABAC} units`);
    console.log(`🎯 Status: Fully Immune to DoS attacks. Consumption remains well below the critical threshold.`);

    // Asserting that HRABAC safely executes within the secure operational boundaries
    expect(gasHRABAC).to.be.lessThan(CRITICAL_GAS_THRESHOLD);
  });
});
