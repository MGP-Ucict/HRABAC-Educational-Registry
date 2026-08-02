import { expect } from "chai";
import hre from "hardhat"; 
import { ethers } from "ethers"; 
import { performance } from "perf_hooks";

describe("HRABACEducationalRegistry - Comprehensive System Tests (Hardhat 3)", function () {
  let registry: any;
  let admin: any;
  let inspector: any;
  let consensusNode: any;
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

  beforeEach(async function () {
    // 1. Explicitly initialize the dynamic network connection required by Hardhat 3
    const networkConnection = await hre.network.create();
    
    // 2. Extract the local network-bound ethers helper context
    const ethersHelper = networkConnection.ethers;
    
    // 3. Fetch independent infrastructure signers
    [admin, inspector, consensusNode, employer, student, maliciousUser] = await ethersHelper.getSigners();

    // Generate high-entropy 32-byte MCP Address tokens for the test configurations
    studentMcpAddress = ethers.id("Student_Static_MCP_Address");
    maliciousMcpAddress = ethers.id("Malicious_Static_MCP_Address");

    // 4. Deploy the deployment factory bound to this connection context via the updated constructor
    const RegistryFactory = await ethersHelper.getContractFactory("HRABACEducationalRegistry");
    registry = await RegistryFactory.deploy(admin.address);
    await registry.waitForDeployment();

    // 5. Technical Administrative Setup (RBAC verification lanes)
    await registry.connect(admin).registerInspector(inspector.address, 50005);
    await registry.connect(admin).registerSystemNode(consensusNode.address, 90009, Role.ConsensusNode);

    // 6. Academic Business Setup (Separation of duties lanes)
    await registry.connect(inspector).registerEmployer(employer.address, 40004);
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

      const nodeProfile = await registry.users(consensusNode.address);
      expect(nodeProfile.role).to.equal(Role.ConsensusNode);
      expect(nodeProfile.isActive).to.be.true;
    });
  });

  // --- SCENARIO 2: HRABAC Gateway Validation with Execution Time Benchmarking ---
  describe("HRABAC Verification Path & Performance", function () {
    it("Should allow Employer to successfully verify a valid diploma-to-MCP link and log latency", async function () {
      await registry.connect(inspector).addDiploma(studentMcpAddress, sampleDiplomaHash);

      // Start high-precision timer
      const startTime = performance.now();

      const isAuthentic = await registry.connect(employer).verifyDiplomaHRABAC.staticCall(studentMcpAddress, sampleDiplomaHash);
      
      // End high-precision timer
      const endTime = performance.now();
      console.log(`\x1b[36m[BENCHMARK] verifyDiplomaHRABAC O(1) Execution Time: ${(endTime - startTime).toFixed(4)} ms\x1b[0m`);
      
      expect(isAuthentic).to.be.true;
    });

    it("Should return false if an Employer evaluates a mismatched student-to-hash relationship", async function () {
      await registry.connect(inspector).addDiploma(studentMcpAddress, sampleDiplomaHash);

      // Employer checks if the hash belongs to maliciousMcpAddress instead of the real student token
      const isAuthentic = await registry.connect(employer).verifyDiplomaHRABAC.staticCall(maliciousMcpAddress, sampleDiplomaHash);
      expect(isAuthentic).to.be.false;
    });
  });

  // --- SCENARIO 3: Access Control & Separation of Duties Boundaries with Time Profiling ---
  describe("Boundary Enforcement & Separation of Duties", function () {
    it("Should block Admin from adding academic data directly and measure reversion overhead", async function () {
      // Tech Admin must not bypass business state logic or insert academic records
      console.time("Admin Rejection Reversion Latency");
      
      await expect(
        registry.connect(admin).addDiploma(studentMcpAddress, sampleDiplomaHash)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedAccess");
      
      console.timeEnd("Admin Rejection Reversion Latency");
    });

    it("Should allow the Admin to manage technical lifecycle (deactivate an abusive Inspector)", async function () {
      // Tech Admin detects an issue and soft-locks the Inspector account
      await expect(registry.connect(admin).setUserActiveStatus(inspector.address, false))
        .to.emit(registry, "RoleStatusChanged");

      // Verify the status was mutated in storage slot layout
      const inspectorProfile = await registry.users(inspector.address);
      expect(inspectorProfile.isActive).to.be.false;
    });

    it("Should block a deactivated Inspector from issuing any diplomas", async function () {
      // Admin soft-locks the Inspector first
      await registry.connect(admin).setUserActiveStatus(inspector.address, false);

      // Inactive Inspector tries to add data -> Must trigger immediate execution revert
      await expect(
        registry.connect(inspector).addDiploma(studentMcpAddress, sampleDiplomaHash)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedAccess");
    });

    it("Should reject an Inspector attempt to modify user active flags", async function () {
      // Inspector tries to override technical settings (Should fail because it is an Admin-only job)
      await expect(
        registry.connect(inspector).setUserActiveStatus(employer.address, false)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedAccess");
    });
  });

  // --- SCENARIO 4: Epoch-Based State Batching Protocol (ecrecover) ---
  describe("Epoch-Based State Batching Protocol (ecrecover)", function () {
    it("Should strictly reject state batch updates containing a corrupted or falsified signature", async function () {
      const nextEpochNonce = 1;
      const proposedStateRoot = ethers.id("Merkle_Root_Epoch_1");
      const manifestHash = ethers.id("Batch_Dataset_BK_1");

      // Generate an unauthorized signature using the maliciousUser account (who lacks ConsensusNode role)
      const fakeSignature = await maliciousUser.signMessage(ethers.toBeArray(manifestHash));

      await expect(
        registry.connect(inspector).updateNationalState(
          nextEpochNonce,
          proposedStateRoot,
          manifestHash,
          fakeSignature
        )
      ).to.be.revertedWithCustomError(registry, "InvalidSignature");
    });

    it("Should reject updates with an out-of-sync epoch nonce (NonceLockViolation)", async function () {
      const brokenEpochNonce = 5; // Sequential state requires currentEpochNonce + 1 (expected: 1)
      const proposedStateRoot = ethers.id("Merkle_Root_Epoch_5");
      const manifestHash = ethers.id("Batch_Dataset_BK_5");

      const dummySig = ethers.hexlify(ethers.randomBytes(65));

      await expect(
        registry.connect(inspector).updateNationalState(
          brokenEpochNonce,
          proposedStateRoot,
          manifestHash,
          dummySig
        )
      ).to.be.revertedWithCustomError(registry, "NonceLockViolation");
    });
  });
});
