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
  
  let targetEpochRoot: string;
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
    targetEpochRoot = ethersCtx.id("Epoch_Root_Batch_001");
  
    // Safe manual buffer packing matching Solidity's abi.encodePacked bit pattern
    const packedSecretBytes = ethersCtx.concat([
      ethersCtx.toUtf8Bytes(targetCitizenName),
      ethersCtx.toUtf8Bytes(targetNationalID)
    ]);
    targetCitizenHash = ethersCtx.keccak256(packedSecretBytes);

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
      
      // Seed database with an Epoch Ingestion Batch containing the target data
      await registry.connect(inspector).emitEpochState(
        targetEpochRoot,
        [targetDiplomaHash],
        [targetCitizenHash],
        [targetEncryptedPayload]
      );
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

      // Create an expanded batch payload to simulate nationwide infrastructure scale inflation
      const dataVolume = 10; 
      const fakeEpochRoot = ethersCtx.id("Epoch_Root_Batch_Fake_002");
      const fakeDiplomaHashes: string[] = [];
      const fakeCitizenHashes: string[] = [];
      const fakePayloads: string[] = [];

      for (let i = 0; i < dataVolume; i++) {
        fakeDiplomaHashes.push(ethersCtx.id(`Fake_Diploma_Hash_${dataVolume}_${i}`));
        fakeCitizenHashes.push(ethersCtx.id(`Fake_Citizen_Hash_${dataVolume}_${i}`));
        fakePayloads.push("Fake_Metadata_Payload");
      }

      // Single batch execution emission bypasses sequential transaction overhead (Nonce Lock Protection)
      await registry.connect(inspector).emitEpochState(fakeEpochRoot, fakeDiplomaHashes, fakeCitizenHashes, fakePayloads);

      const gasWithManyRecords = await registry.connect(employer).verifyAndFetchMetadata.estimateGas(
        targetDiplomaHash,
        targetCitizenHash
      );

      console.log(`\x1b[32m[GAS REPORT] 1 Record: ${gasWithOneRecord.toString()} | ${dataVolume} Records: ${gasWithManyRecords.toString()}\x1b[0m`);

      // Assert state layout optimizations fully isolate runtime calculations from storage data debt
      expect(gasWithManyRecords).to.equal(gasWithOneRecord, "Gas variance detected! Not O(1) constant-time complexity.");
      expect(gasWithManyRecords).to.equal(41539n, "Gas footprint does not match the strict academic framework ceiling.");
    });

    it("Should revert if an Employer evaluates a deactivated student profile (GDPR Article 17)", async function () {
      await registry.connect(admin).setStudentDeactivatedStatus(targetCitizenHash, true);
      
      // Evaluation should immediately trap the privacy lifecycle barrier and throw an EVM exception
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
    it("Should block Admin from adding academic batch data directly and measure reversion overhead", async function () {
      console.time("Admin Rejection Reversion Latency");
      
      const localEpochRoot = ethersCtx.id("Local_Epoch_Root");
      const localDiplomaHash = ethersCtx.id("Target_Academic_Diploma_2026");
      const localCitizenHash = ethersCtx.id("Target_Citizen_Hash_Context");
      const localPayload = "Test_Payload";

      try {
        await registry.connect(admin).emitEpochState(localEpochRoot, [localDiplomaHash], [localCitizenHash], [localPayload]);
        expect.fail("Transaction should have reverted but it succeeded");
      } catch (error: any) {
        expect(error.message).to.include("reverted");
      }
      
      console.timeEnd("Admin Rejection Reversion Latency");
    });

    it("Should allow the Admin to manage technical lifecycle via setUserActiveStatus", async function () {
      // Execute the technical administration core status adjustment primitive
      await registry.connect(admin).setUserActiveStatus(inspector.address, false);
      const inspectorProfile = await registry.users(inspector.address);
      expect(inspectorProfile.isActive).to.be.false;
    });
  });

  // --- SCENARIO 4: Academic Invariant 3 Verification (Disaster Recovery Bound) ---
  describe("Disaster Recovery Point Verification (Invariant 3)", function () {
    it("Should support instant O(1) latest epoch extraction to resolve the Cold Start Paradox", async function () {
      await registry.connect(inspector).emitEpochState(
        targetEpochRoot,
        [targetDiplomaHash],
        [targetCitizenHash],
        [targetEncryptedPayload]
      );

      // Passive Shadow Node query simulation execution
      const latestRoot = await registry.getLatestEpochRoot();
      expect(latestRoot).to.equal(targetEpochRoot);
    });
  });
});
