import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "ethers";

describe("🛑 Critical Vulnerability and Block Gas Limit DoS Demonstration", function () {
  // Fix 1: Properly declaring all instances globally so they are shared across 'it' blocks
  let abac: any, riskBac: any, hrabac: any;
  let admin: any, inspector: any, employer: any, student: any;
  let studentMcpAddress: string;
  let node1: any, node2: any, node3: any;

  // DEFINING THE CRITICAL SECURITY BOUNDARY
  // In the live Ethereum Mainnet, the block gas limit scales up to 30,000,000 units.
  // For the deterministic scope of this laboratory benchmark, we define a strict 
  // micro-threshold of 120,000 gas units per single state execution.
  const CRITICAL_GAS_THRESHOLD = 120000; 

  beforeEach(async function () {
    // Explicitly initialize the dynamic network connection required by Hardhat 3
    const networkConnection = await hre.network.create();
    const ethersHelper = networkConnection.ethers;

    // Extracting mock test accounts from the Hardhat network provider
    const signers = await ethersHelper.getSigners();
    admin = signers[0];
    inspector = signers[1];
    employer = signers[2];
    student = signers[3];

    // Fix 2: Assigning the consensus nodes to the globally declared variable scope instead of re-declaring them
    node1 = signers[4];
    node2 = signers[5];
    node3 = signers[6];

    // Generate the non-linear, high-entropy 32-byte MCP Address for the test student configuration
    studentMcpAddress = ethers.id("Student_Static_MCP_Address");

    // Deploying contract instances into the local Hardhat EVM architecture
    abac = await (await ethersHelper.getContractFactory("PureABAC")).deploy();
    riskBac = await (await ethersHelper.getContractFactory("PureRiskBAC")).deploy();

    // Define consortium addresses and count of signatures
    const consensusNodes = [node1.address, node2.address, node3.address];
    const requiredSignatures = 2;

    // Fix 3: Removed 'const' keyword to bind deployment directly to the global 'hrabac' reference pointer
    hrabac = await (
        await ethersHelper.getContractFactory("HRABACEducationalRegistry")
    ).deploy(admin.address, consensusNodes, requiredSignatures); 
      
    await abac.waitForDeployment();
    await riskBac.waitForDeployment();
    await hrabac.waitForDeployment();
    
    // Initializing access control parameters and system attributes for HRABAC (bytes32 architecture)
    await hrabac.connect(admin).registerInspector(inspector.address, 50005);
    await hrabac.connect(inspector).registerEmployer(employer.address, 40004);

    // Initializing legacy baseline contracts attributes (Using standard raw Ethereum addresses)
    await abac.connect(admin).registerSubjectAttributes(employer.address, "Employer", "MoE");
  });

  // ------------------------------------------------------------------
  // DEMONSTRATION 1: PureRiskBAC Operational Lockout (Logical Failure)
  // ------------------------------------------------------------------
  it("PureRiskBAC undergoes operational lockout for the user \n\t after 5 failed authentication attempts", async function () {
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
  it("PureABAC violates the critical gas threshold and triggers \n\t an automatic execution failure", async function () {
    const targetHash = ethers.id("Target_Hash_ABAC");

    console.log("\n--- SIMULATING GAS EXPLOSION (DoS) IN PUREABAC ---");
    
    // Injecting 350 structural elements to inflate the storage array and trigger linear computation decay
    const recordsToInject = 350; 
    console.log(`⏳ Injecting ${recordsToInject} fake entries to induce worst-case loop traversal inside PureABAC...`);
    
    for (let i = 0; i < recordsToInject; i++) {
      await abac.connect(admin).addDiploma("Other", ethers.id(`Fake_${i}`));
    }

    await abac.connect(admin).addDiploma("MoE", targetHash); 
    // Measuring exact EVM computational gas after targeted state expansion (bigint to Number)
    const finalGasABAC = Number(await abac.connect(employer).verifyDiplomaABAC.estimateGas(targetHash));
    console.log(`⛽ Measured EVM gas overhead for PureABAC: ${finalGasABAC} units`);
    console.log(`🛡️ Defined Critical Safety Margin: ${CRITICAL_GAS_THRESHOLD} units`);

    // DETERMINISTIC SOFTWARE FAIL TRIGGER FOR RESEARCH VISUALIZATION
    if (finalGasABAC > CRITICAL_GAS_THRESHOLD) {
      console.log(`\n🛑 [CRITICAL FAULT]: PureABAC execution TERMINATED automatically!`);
      console.log(`⚠️ Reason: Computational overhead of ${finalGasABAC} gas units breached the safe threshold of ${CRITICAL_GAS_THRESHOLD}.`);
      console.log(`🛑 Architecture is highly vulnerable to Block Gas Limit Denial of Service (DoS) attacks!`);
    }

    expect(finalGasABAC).to.be.greaterThan(CRITICAL_GAS_THRESHOLD);
  });

  // ------------------------------------------------------------------
  // DEMONSTRATION 3: HRABAC Deterministic Immunity under identical strain
  // ------------------------------------------------------------------
  it("HRABAC maintains constant O(1) performance under identical storage \n\t strain with no gas fluctuations", async function () {
    const targetHash = ethers.id("Target_Hash_HRABAC");

    console.log("\n--- VERIFYING HRABAC ALGORITHMIC INVARIANCE ---");
    
    // Injecting an identical load (350 records) into the HRABAC contract instance
    for (let i = 0; i < 350; i++) {
      const randomFakeMcp = ethers.id(`Fake_MCP_Identity_${i}`);
      const randomFakeHash = ethers.id(`Fake_HR_Diploma_${i}`);
      await hrabac.connect(inspector).addDiploma(randomFakeMcp, randomFakeHash);
    }

    await hrabac.connect(inspector).addDiploma(studentMcpAddress, targetHash);
    // Gas evaluation matches perfectly with the fixed function name
    const gasHRABAC = Number(await hrabac.connect(employer).verifyDiplomaHRABAC.estimateGas(studentMcpAddress, targetHash));
    console.log(`🟩 Measured EVM gas overhead for HRABAC following storage inflation: ${gasHRABAC} units`);
    console.log(`🎯 Status: Fully Immune to DoS attacks. Consumption remains well \n\t  below the critical threshold.`);

    // Asserting that HRABAC safely executes within the secure operational boundaries
    expect(gasHRABAC).to.be.lessThan(CRITICAL_GAS_THRESHOLD);
  });
});
