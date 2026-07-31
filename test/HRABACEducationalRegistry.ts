import { expect } from "chai";
import hre  from "hardhat";
const { ethers } = await hre.network.create(); 

describe("HRABACEducationalRegistry - Separation of Duties Tests", function () {
  let registry: any;
  let admin: any;
  let inspector: any;
  let student: any;
  let employer: any;
  let maliciousUser: any;
  
  let studentMcpAddress: string;
  let maliciousMcpAddress: string;

  // Exact mappings from the updated Solidity contract Enums (Graduate role decoupled off-chain)
  const Role = {
    None: 0,
    Admin: 1,
    Inspector: 2,
    Employer: 3
  };

  // Mock document hash representing a PDF diploma
  const sampleDiplomaHash = ethers.keccak256(ethers.toUtf8Bytes("Diploma_John_Doe_2026"));

  beforeEach(async function () {
    // 1. Fetch distinct infrastructure accounts
    [admin, inspector, student, employer, maliciousUser] = await ethers.getSigners();

    // Generate high-entropy 32-byte MCP Address tokens for the test configurations
    studentMcpAddress = ethers.id("Student_Static_MCP_Address");
    maliciousMcpAddress = ethers.id("Malicious_Static_MCP_Address");

    // 2. Deploy contract, explicitly injecting the Inspector address into the constructor
    const RegistryFactory = await ethers.getContractFactory("HRABACEducationalRegistry");
    registry = await RegistryFactory.deploy(inspector.address);
    await registry.waitForDeployment();

    // 3. Complete basic institutional setup via the correct role lanes
    // Admin registers an additional profile setup if necessary, Inspector registers business roles
    await registry.connect(admin).registerInspector(inspector.address, 50005);
    await registry.connect(inspector).registerEmployer(employer.address, 40004);
  });

  // --- SCENARIO 1: Strict Role Verification during Deployment ---
  describe("Deployment & Initialization Verification", function () {
    it("Should correctly assign Admin role to the deployer and Inspector role to the target address", async function () {
      const adminProfile = await registry.users(admin.address);
      expect(adminProfile.role).to.equal(Role.Admin);
      expect(adminProfile.isActive).to.be.true;

      const inspectorProfile = await registry.users(inspector.address);
      expect(inspectorProfile.role).to.equal(Role.Inspector);
      expect(inspectorProfile.isActive).to.be.true;
    });
  });

  // --- SCENARIO 2: Testing Admin Constraint Boundaries (The Programmer cannot act as an Academic entity) ---
  describe("Admin Boundary Enforcement (Separation of Duties)", function () {
    it("Should reject an Admin attempt to add a diploma hash", async function () {
      // Crucial test for security audit: Programmer tries to bypass business state logic using MCP token
      await expect(
        registry.connect(admin).addDiploma(studentMcpAddress, sampleDiplomaHash)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedAccess");
    });

    it("Should allow the Admin to manage technical lifecycle (deactivate an abusive Inspector)", async function () {
      // Tech Admin detects an issue and soft-locks the Inspector account
      await expect(registry.connect(admin).setUserActiveStatus(inspector.address, false))
        .to.emit(registry, "RoleStatusChanged");

      // Verify the status was mutated in storage slot layout
      const inspectorProfile = await registry.users(inspector.address);
      expect(inspectorProfile.isActive).to.be.false;
    });
  });

  // --- SCENARIO 3: Testing Inspector Constraint Boundaries (The Academic entity cannot manipulate configuration) ---
  describe("Inspector Boundary Enforcement", function () {
    it("Should allow an active Inspector to issue a valid diploma via MCP routing", async function () {
      // Valid business workflow path execution using bytes32 tokens
      await expect(registry.connect(inspector).addDiploma(studentMcpAddress, sampleDiplomaHash))
        .to.emit(registry, "DiplomaAdded");
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

  // --- SCENARIO 4: HRABAC Verification Mechanism (Employer evaluation path) ---
  describe("HRABAC Verification Path", function () {
    it("Should successfully authorize a valid student diploma match when queried by a registered Employer", async function () {
      // 1. Inspector adds the diploma hash onto the ledger stack linked to the MCP Address
      await registry.connect(inspector).addDiploma(studentMcpAddress, sampleDiplomaHash);

      // 2. Employer executes a direct key-value validation lookup in strict O(1)
      const isAuthentic = await registry.connect(employer).verifyDiploma.staticCall(studentMcpAddress, sampleDiplomaHash);
      expect(isAuthentic).to.be.true;
    });

    it("Should return false if an Employer evaluates a mismatched student-to-hash relationship", async function () {
      await registry.connect(inspector).addDiploma(studentMcpAddress, sampleDiplomaHash);

      // Employer checks if the hash belongs to maliciousMcpAddress instead of the real student token
      const isAuthentic = await registry.connect(employer).verifyDiploma.staticCall(maliciousMcpAddress, sampleDiplomaHash);
      expect(isAuthentic).to.be.false;
    });
  });
});
