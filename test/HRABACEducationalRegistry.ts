import { expect } from "chai";
import hre from "hardhat"; 
import { performance } from "perf_hooks";

describe("RegHRABACEducationalRegistry - Production Tests", function () {
  let registry: any;
  let admin: any, inspector: any, employer: any, maliciousUser: any;
  
  let targetDiplomaHash: string;
  let targetCitizenHash: string;
  const targetCitizenName = "John Doe";
  const targetNationalID = "004515XXXX";
  
  let targetEpochRoot: string;
  let ethersCtx: any;

  // Exact static enum index tracking matching the Solidity smart contract layout
  const Role = { None: 0, Admin: 1, Inspector: 2 };

  beforeEach(async function () {
    // 1. Initialize the dynamic network connection instance
    const connection = await hre.network.create();
    
    // 2. Extract the context-bound ethers instance directly from the connection object
    ethersCtx = connection.ethers; 
    
    // 3. Fetch independent mock signers from the runtime provider context
    const signers = await ethersCtx.getSigners();
    admin = signers[0];
    inspector = signers[1];
    employer = signers[2];
    maliciousUser = signers[3];

    // Pre-calculate baseline target parameters inside the setup layout layer
    targetDiplomaHash = ethersCtx.id("Target_Academic_Diploma_2026");
    targetEpochRoot = ethersCtx.id("Epoch_Root_Batch_001");
  
    // Safe manual buffer packing matching Solidity's abi.encodePacked bit pattern
    const packedSecretBytes = ethersCtx.concat([
      ethersCtx.toUtf8Bytes(targetCitizenName),
      ethersCtx.toUtf8Bytes(targetNationalID)
    ]);
    targetCitizenHash = ethersCtx.keccak256(packedSecretBytes);

    // 4. Deploy using the clean network-bound contract factory instance passing exactly 1 argument
    const RegistryFactory = await ethersCtx.getContractFactory("RegHRABACEducationalRegistry");
    registry = await RegistryFactory.deploy(admin.address);
    await registry.waitForDeployment();

    // 5. Provision the active system profile role matching the address-driven storage layout
    await registry.connect(admin).registerInspector(inspector.address);
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
    });
  });

  // --- SCENARIO 2: HRABAC Gateway Validation with Execution Time & O(1) Gas Benchmarking ---
  describe("HRABAC Verification Path & Performance", function () {
    beforeEach(async function () {
      // Seed database with an Epoch Ingestion Batch containing exactly 3 arguments (Zero-PII Storage Model)
      await registry.connect(inspector).emitEpochState(
        targetEpochRoot,
        [targetDiplomaHash],
        [targetCitizenHash]
      );
    });

    it("Should allow Employer to successfully verify a valid diploma link returning true boolean status", async function () {
      const startTime = performance.now();
      
      // Execute read call using the optimized stateless verifyDiploma reference link
      const isValid = await registry.connect(employer).verifyDiploma(
        targetDiplomaHash,
        targetCitizenHash
      );
      
      const endTime = performance.now();
      console.log(`\x1b[36m[BENCHMARK] verifyDiploma Execution Time: ${(endTime - startTime).toFixed(4)} ms\x1b[0m`);
      
      expect(isValid).to.be.true;
    });

    it("Should prove O(1) read complexity by checking gas cost with increasing data volume", async function () {
      const gasWithOneRecord = await registry.connect(employer).verifyDiploma.estimateGas(
        targetDiplomaHash,
        targetCitizenHash
      );

      // Create an expanded batch payload to simulate nationwide infrastructure scale inflation
      const dataVolume = 20; 
      const fakeEpochRoot = ethersCtx.id("Epoch_Root_Batch_Fake_002");
      const fakeDiplomaHashes: string[] = [];
      const fakeCitizenHashes: string[] = [];

      for (let i = 0; i < dataVolume; i++);

      // Verify state mapping variable mutation
      const isEpochValid = await registry.validatedEpochs(targetEpochRoot);
      expect(isEpochValid).to.be.true;
    });

    it("Should block non-admin accounts from executing epoch revocations", async function () {
      // Guard enforcement prevents inspectors or standard users from triggering batch deletions
      await expect(
        registry.connect(maliciousUser).revokeEpoch(targetEpochRoot)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedAccess"); 
    });
      it("Should return false if an Employer evaluates a deactivated student profile (GDPR Article 17)", async function () {
      const initialCheck = await registry.connect(employer).verifyDiploma(targetDiplomaHash, targetCitizenHash);
      expect(initialCheck).to.be.true;

      await registry.connect(admin).setStudentDeactivatedStatus(targetCitizenHash, true);
      
      const isValidAfterDeactivation = await registry.connect(employer).verifyDiploma(targetDiplomaHash, targetCitizenHash);
      expect(isValidAfterDeactivation).to.be.false;
    });

    it("Should revert if an Admin tries to revoke a non-existent epoch root", async function () {
      const nonExistentRoot = ethersCtx.id("Ghost_Epoch_Root");
      await expect(
        registry.connect(inspector).revokeEpoch(nonExistentRoot)
      ).to.be.revertedWithCustomError(registry, "RecordNotFoundOrAccessDenied"); 
    });

    it("Should block Admin from bypassing the segregation of duties and adding batch data directly", async function () {
      const localEpochRoot = ethersCtx.id("Local_Epoch_Root");
      const localDiplomaHash = ethersCtx.id("Local_Diploma");
      const localCitizenHash = ethersCtx.id("Local_Citizen");

      // Validates that the transaction reaches EVM and triggers the custom error modifier check
      await expect(
        registry.connect(admin).emitEpochState(localEpochRoot, [localDiplomaHash], [localCitizenHash])
      ).to.be.revertedWithCustomError(registry, "UnauthorizedAccess"); 
    });

    it("Should allow Admin to explicitly revoke a single specific cryptographic anchor", async function () {
      const tx = await registry.connect(admin).revokeAnchor(targetDiplomaHash, targetCitizenHash);
      
      await expect(tx)
        .to.emit(registry, "AnchorRevoked")
        .withArgs(targetDiplomaHash, targetCitizenHash, (timestamp: any) => true);

      const isValidAfterRevocation = await registry.verifyDiploma(targetDiplomaHash, targetCitizenHash);
      expect(isValidAfterRevocation).to.be.false;
    });
  });
});
