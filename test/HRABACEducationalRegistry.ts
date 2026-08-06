import { expect } from "chai";
import hre from "hardhat"; 
import { performance } from "perf_hooks";

describe("HRABACEducationalRegistry - Comprehensive System Tests", function () {
  let registry: any;
  let admin: any, inspector: any, employer: any, maliciousUser: any, graduate: any;
  
  let targetDiplomaHash: string;
  let targetCitizenHash: string;
  const targetCitizenName = "John Doe";
  const targetNationalID = "004515XXXX";
  const targetEncryptedPayload = "Encrypted_University_Sofia_Computer_Science_Excellent_5.80";
  
  let ethersCtx: any;

  // Perfect static enum index tracking matching the Solidity smart contract layout
  const Role = { None: 0, Admin: 1, Inspector: 2, Employer: 3 };

  beforeEach(async function () {
    // 1. HARDHAT 3 CORE ENGINE RULE: Initialize the dynamic network connection instance
    const connection = await hre.network.create();
    
    // 2. Extract the context-bound ethers instance directly from the connection object
    ethersCtx = connection.ethers; 
    
    // 3. Fetch independent mock signers from the runtime provider context
    const signers = await ethersCtx.getSigners();
    admin = signers[0];
    inspector = signers[1];
    employer = signers[2];
    maliciousUser = signers[3];
    graduate = signers[4];

    // Pre-calculate baseline target parameters inside the setup layout layer
    targetDiplomaHash = ethersCtx.id("Target_Academic_Diploma_2026");
  
    targetCitizenHash = ethersCtx.solidityPackedKeccak256(
      ["string", "string"], 
      [targetCitizenName, targetNationalID]
    );

    // 4. Deploy using the clean network-bound contract factory instance passing exactly 1 argument
    const RegistryFactory = await ethersCtx.getContractFactory("HRABACEducationalRegistry");
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
      // Setup structural trust parameters using pure signer wallets
      await registry.connect(inspector).registerEmployer(employer.address);
      
     // Safe manual buffer packing matching Solidity's abi.encodePacked bit pattern
    const packedSecretBytes = ethersCtx.concat([
      ethersCtx.toUtf8Bytes("John Doe"),
      ethersCtx.toUtf8Bytes("004515XXXX")
    ]);
    const targetCitizenHash = ethersCtx.keccak256(packedSecretBytes);
    
    const targetPayload = "Encrypted_University_Sofia_Computer_Science_Excellent_5.80"; 
    
    // Seed database with the correct mapped properties passing exactly 3 arguments
    await registry.connect(inspector).addDiploma(targetDiplomaHash, targetCitizenHash, targetPayload);

    });

    it("Should allow Employer to successfully verify a valid diploma link and pull cipher logs", async function () {
      const startTime = performance.now();
      
     const returnedPayload = await registry.connect(employer).verifyAndFetchMetadata(
        targetDiplomaHash,
        targetCitizenHash
      );
      
      const endTime = performance.now();
      console.log(`\x1b[36m[BENCHMARK] verifyAndFetchMetadata Execution Time: ${(endTime - startTime).toFixed(4)} ms\x1b[0m`);
      expect(returnedPayload).to.equal(targetEncryptedPayload);
    });

    it("Should prove O(1) read complexity by checking gas cost with increasing data volume", async function () {
      const gasWithOneRecord: bigint = await registry.connect(employer).verifyAndFetchMetadata.estimateGas(
        targetDiplomaHash,
        targetCitizenHash
      );

      const dataVolume = 10; 
      for (let i = 0; i < dataVolume; i++) {
        const fakeDiplomaHash = ethersCtx.id(`Fake_Diploma_Hash_${dataVolume}_${i}`); 
        const fakeCitizenHash = ethersCtx.id(`Fake_Citizen_Hash_${dataVolume}_${i}`); 
        
        // Populate the ledger index mapping layer sequentially with isolated entries
        await registry.connect(inspector).addDiploma(fakeDiplomaHash, fakeCitizenHash, "Fake_Metadata_Payload");
      }

      const gasWithManyRecords = await registry.connect(employer).verifyAndFetchMetadata.estimateGas(
        targetDiplomaHash,
        targetCitizenHash
      );

      console.log(`\x1b[32m[GAS REPORT] 1 Record: ${gasWithOneRecord.toString()} | ${dataVolume} Records: ${gasWithManyRecords.toString()}\x1b[0m`);

      expect(gasWithManyRecords).to.equal(gasWithOneRecord, "Gas variance detected! Not O(1) constant-time complexity.");
      expect(gasWithManyRecords).to.equal(37187n, "Gas footprint does not match the strict academic framework ceiling.");
    });

    it("Should return false or revert if an Employer evaluates a deactivated student profile", async function () {
      // FIX: Passing the direct literal string hash context to allow error traps inside EDR simulations
      await registry.connect(admin).setStudentDeactivatedStatus(targetCitizenHash, true);
      
      // Evaluation should immediately trap the security threshold and throw an EVM exception
      try {
        await registry.connect(employer).verifyAndFetchMetadata(
          targetDiplomaHash,
          targetCitizenHash
        );
        expect.fail("Transaction should have reverted due to deactivation");
      } catch (error: any) {
        expect(error.message).to.include("reverted");
      }
    });

    it("Should revert if an Employer evaluates a mismatched identity string relationship", async function () {
      const fakeCitizenHash = ethersCtx.id(`Fake_Citizen_Hash`); 
      try {
        // Trigger structural verification under invalid name vectors to force an identity mismatch revert
        await registry.connect(employer).verifyAndFetchMetadata(
          targetDiplomaHash,
          fakeCitizenHash
        );
        expect.fail("Transaction should have reverted due to identity mismatch");
      } catch (error: any) {
        expect(error.message).to.include("reverted");
      }
    });
  });

  // --- SCENARIO 3: Access Control & Separation of Duties Boundaries ---
  describe("Boundary Enforcement & Separation of Duties", function () {
    it("Should block Admin from adding academic data directly and measure reversion overhead", async function () {
      console.time("Admin Rejection Reversion Latency");
      
      const localDiplomaHash = ethersCtx.id("Target_Academic_Diploma_2026");
      const localCitizenHash = ethersCtx.id("Target_Citizen_Hash_Context");
      const localPayload = "Test_Payload";

      try {
        await registry.connect(admin).addDiploma(localDiplomaHash, localCitizenHash, localPayload);
        expect.fail("Transaction should have reverted but it succeeded");
      } catch (error: any) {
        expect(error.message).to.include("reverted");
      }
      
      console.timeEnd("Admin Rejection Reversion Latency");
    });

    it("Should allow the Admin to manage technical lifecycle (deactivate an abusive Inspector)", async function () {
      await registry.connect(admin).setUserActiveStatus(inspector.address, false);
      const inspectorProfile = await registry.users(inspector.address);
      expect(inspectorProfile.isActive).to.be.false;
    });
  });
});
