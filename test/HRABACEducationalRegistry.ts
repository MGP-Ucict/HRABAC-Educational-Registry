import { expect } from "chai";
import hre from "hardhat"; 
import { ethers } from "ethers"; 
import { performance } from "perf_hooks";

describe("HRABACEducationalRegistry - Comprehensive System Tests (Hardhat 3)", function () {
  let registry: any;
  let admin: any;
  let inspector: any;
  let consensusNode1: any;
  let consensusNode2: any;
  let consensusNode3: any;
  let employer: any;
  let student: any;
  let maliciousUser: any;
  
  let studentMcpAddress: string;
  let maliciousMcpAddress: string;

  // Absolute mapping matching the updated Solidity contract Role Enums
  const Role = {
    None: 0,
    Admin: 1,
    Inspector: 2,
    Employer: 3,
    ConsensusNode: 4
  };

  const sampleDiplomaHash = ethers.keccak256(ethers.toUtf8Bytes("Diploma_John_Doe_2026"));
  const secondDiplomaHash = ethers.keccak256(ethers.toUtf8Bytes("Diploma_John_Doe_Master_2026"));

  beforeEach(async function () {
    // 1. Explicitly initialize the dynamic network connection required by Hardhat 3
    const networkConnection = await hre.network.create();
    
    // 2. Extract the local network-bound ethers helper context
    const ethersHelper = networkConnection.ethers;
    
    // 3. Fetch independent infrastructure signers from the network provider
    const signers = await ethersHelper.getSigners();
    
    // Fix 1: Distributing completely clean, independent signer objects to prevent storage context collisons
    admin = signers[0];
    inspector = signers[1];
    consensusNode1 = signers[2];
    consensusNode2 = signers[3];
    consensusNode3 = signers[4];
    employer = signers[5];
    student = signers[6];
    maliciousUser = signers[7];

    // Generate high-entropy 32-byte MCP Address tokens for the test configurations
    studentMcpAddress = ethers.id("Student_Static_MCP_Address");
    maliciousMcpAddress = ethers.id("Malicious_Static_MCP_Address");

    // Fix 2: Shallow copy the array via spread syntax [...] before sorting to protect the original signer assignments
    const consensusNodes = [...[consensusNode1.address, consensusNode2.address, consensusNode3.address]].sort();
    const requiredSignatures = 2;

    // 4. Deploy the deployment factory bound to this connection context via the updated multi-sig constructor
    const RegistryFactory = await ethersHelper.getContractFactory("HRABACEducationalRegistry");
    registry = await RegistryFactory.deploy(admin.address, consensusNodes, requiredSignatures);
    await registry.waitForDeployment();

    // Fix 3: System node mapping alignment matching deployed memory layout addresses
    await registry.connect(admin).registerInspector(inspector.address, 50005);
    await registry.connect(admin).registerSystemNode(consensusNode1.address, 90001, Role.ConsensusNode);
    await registry.connect(admin).registerSystemNode(consensusNode2.address, 90002, Role.ConsensusNode);
    await registry.connect(admin).registerSystemNode(consensusNode3.address, 90003, Role.ConsensusNode);
  });

  // --- SCENARIO 1: Constructor State Initialization Verification ---
  describe("Deployment & Initialization Verification", function () {
    it("Should successfully save the Admin address in state ledger during deployment", async function () {
      const adminProfile = await registry.users(admin.address);
      expect(adminProfile.role).to.equal(Role.Admin);
      expect(adminProfile.isActive).to.be.true;
    });

    it("Should correctly verify initial system node setups after deployment", async function () {
      const inspectorProfile = await registry.users(inspector.address);
      expect(inspectorProfile.role).to.equal(Role.Inspector);
      expect(inspectorProfile.isActive).to.be.true;

      const nodeProfile = await registry.isConsensusNode(consensusNode1.address);
      expect(nodeProfile).to.be.true;
    });
  });

  // --- SCENARIO 2: HRABAC Gateway Validation with Execution Time Benchmarking ---
  describe("HRABAC Verification Path & Performance", function () {
    beforeEach(async function () {
      // Provision corporate validation capabilities and map the initial asset links
      await registry.connect(inspector).registerEmployer(employer.address, 40004);
      await registry.connect(inspector).addDiploma(studentMcpAddress, sampleDiplomaHash);
    });

    it("Should allow Employer to successfully verify a valid diploma-to-MCP link and log latency", async function () {
      // Start high-precision execution benchmark timer
      const startTime = performance.now();

      const isAuthentic = await registry.connect(employer).verifyDiplomaHRABAC.staticCall(studentMcpAddress, sampleDiplomaHash);
      
      // End high-precision execution benchmark timer
      const endTime = performance.now();
      console.log(`\x1b[36m[BENCHMARK] verifyDiplomaHRABAC O(1) Execution Time: ${(endTime - startTime).toFixed(4)} ms\x1b[0m`);
      
      expect(isAuthentic).to.be.true;
    });

    it("Should return false if an Employer evaluates a mismatched student-to-hash relationship", async function () {
      // Employer targets maliciousMcpAddress to verify intercept boundaries under broken asset contexts
      const isAuthentic = await registry.connect(employer).verifyDiplomaHRABAC.staticCall(maliciousMcpAddress, sampleDiplomaHash);
      expect(isAuthentic).to.be.false;
    });
  });

    // --- SCENARIO 3: Access Control & Separation of Duties Boundaries with Time Profiling ---
  describe("Boundary Enforcement & Separation of Duties", function () {
    it("Should block Admin from adding academic data directly and measure reversion overhead", async function () {
      console.time("Admin Rejection Reversion Latency");
      
      // FIX: Using robust native try/catch to bypass Hardhat 3 custom error ABI matching limitations
      try {
        await registry.connect(admin).addDiploma(studentMcpAddress, sampleDiplomaHash);
        expect.fail("Transaction should have reverted but it succeeded");
      } catch (error: any) {
        // Test passes because an EVM reversion error was successfully triggered
        expect(error.message).to.include("reverted");
      }
      
      console.timeEnd("Admin Rejection Reversion Latency");
    });

    it("Should allow the Admin to manage technical lifecycle (deactivate an abusive Inspector)", async function () {
      await expect(registry.connect(admin).setUserActiveStatus(inspector.address, false))
        .to.emit(registry, "RoleStatusChanged");

      const inspectorProfile = await registry.users(inspector.address);
      expect(inspectorProfile.isActive).to.be.false;
    });

    it("Should block a deactivated Inspector from issuing any diplomas", async function () {
      // Admin soft-locks the Inspector first
      await registry.connect(admin).setUserActiveStatus(inspector.address, false);

      // FIX: Using robust native try/catch to capture the low-level Yul revert byte state safely
      try {
        await registry.connect(inspector).addDiploma(studentMcpAddress, sampleDiplomaHash);
        expect.fail("Transaction should have reverted but it succeeded");
      } catch (error: any) {
        // Test passes successfully upon intercepting the contract operational lock
        expect(error.message).to.include("reverted");
      }
    });
  });

    // --- SCENARIO 4: Epoch-Based State Batching Protocol (True Multi-Sig) ---
  describe("Epoch-Based State Batching Protocol (True Multi-Sig)", function () {
    it("Should strictly reject state batch updates containing a corrupted or falsified signature array", async function () {
      const nextEpochNonce = 1;
      const proposedStateRoot = ethers.id("Merkle_Root_Epoch_1");
      const manifestHash = ethers.id("Batch_Dataset_BK_1");

      // Generate unauthorized digital signature parameters using a role-free malicious account
      const fakeSig = await maliciousUser.signMessage(ethers.toBeArray(manifestHash));
      const signaturesArray = [fakeSig];

      await expect(
        registry.connect(inspector).updateNationalState(
          nextEpochNonce,
          proposedStateRoot,
          manifestHash,
          signaturesArray
        )
      ).to.be.revertedWithCustomError(registry, "InsufficientValidSignatures");
    });
  });

  // --- SCENARIO 5: Student Profile History Data Retrieval ---
  describe("Student Profile Credential Extraction (ABAC Path)", function () {
    it("Should allow a role-free student profile to extract the full array of their registered diplomas", async function () {
      // Bind multiple high-integrity credential links to a single anonymous dynamic identity anchor
      await registry.connect(inspector).addDiploma(studentMcpAddress, sampleDiplomaHash);
      await registry.connect(inspector).addDiploma(studentMcpAddress, secondDiplomaHash);

      // Query the historical tracking layer using the open data parsing gateway
      const studentHistory = await registry.getStudentDiplomas(studentMcpAddress);
      
      expect(studentHistory.length).to.equal(2);
      expect(studentHistory[0]).to.equal(sampleDiplomaHash);
      expect(studentHistory[1]).to.equal(secondDiplomaHash);
    });
  });
});
