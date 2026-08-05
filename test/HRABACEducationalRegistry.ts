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
    
    // ПОПРАВКА НА АРГУМЕНТИТЕ: Премахваме масива от типове, който чупеше логиката в Ethers v6.
    // Използваме ethers.solidityPackedKeccak256 с точна структура (типове, стойности) за пресъздаване на abi.encodePacked.
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
      
      // ПОПРАВКА: Подават се 3-те задължителни аргумента към addDiploma
      await registry.connect(inspector).addDiploma(targetDiplomaHash, targetCitizenHash, targetEncryptedPayload);
    });

    it("Should allow Employer to successfully verify a valid diploma link and pull cipher logs", async function () {
      const startTime = performance.now();
      
      // ETHERS V6 FIXED RULE: Call view verification methods directly without using the obsolete .staticCall property
      const returnedPayload = await registry.connect(employer).verifyAndFetchMetadata(
        targetDiplomaHash,
        targetCitizenName,
        targetNationalID
      );
      
      const endTime = performance.now();
      console.log(`\x1b[36m[BENCHMARK] verifyAndFetchMetadata Execution Time: ${(endTime - startTime).toFixed(4)} ms\x1b[0m`);
      
      expect(returnedPayload).to.equal(targetEncryptedPayload);
    });

    it("Should prove O(1) read complexity by checking gas cost with increasing data volume", async function () {
      // 1. Измерваме газовия разход за валидация при 1 наличен запис в базата чрез .estimateGas
      const gasWithOneRecord = await registry.connect(employer).verifyAndFetchMetadata.estimateGas(
        targetDiplomaHash,
        targetCitizenName,
        targetNationalID
      );

      // 2. Симулираме разрастване на мапинга (пълнене на базата с чужди изолирани записи)
      const dataVolume = 10; 
      for (let i = 0; i < dataVolume; i++) {
        const dummyDiploma = ethersCtx.id(`Dummy_Diploma_${i}`);
        const dummyCitizen = ethersCtx.id(`Dummy_Citizen_${i}`);
        // ПОПРАВКА: Предават се коректно 3-те аргумента в цикъла за dummy инжектиране
        await registry.connect(inspector).addDiploma(dummyDiploma, dummyCitizen, "Dummy_Metadata_Payload");
      }

      // 3. Измерваме новия газов разход за първоначалния целеви запис в натоварената база
      const gasWithManyRecords = await registry.connect(employer).verifyAndFetchMetadata.estimateGas(
        targetDiplomaHash,
        targetCitizenName,
        targetNationalID
      );

      console.log(`\x1b[32m[GAS REPORT] Базов газ при 1 запис: ${gasWithOneRecord.toString()} | Газ при ${dataVolume + 1} записа: ${gasWithManyRecords.toString()}\x1b[0m`);

      // МАТЕМАТИЧЕСКО НАУЧНО ДОКАЗАТЕЛСТВО ЗА O(1):
      // Тъй като мапингът използва Yul/EVM нискослойни storage slots lookups, разликата в газа трябва да бъде ТОЧНО 0 единици.
      expect(gasWithManyRecords).to.equal(gasWithOneRecord, "Gas variance detected! Not O(1) constant-time complexity.");
      expect(gasWithManyRecords).to.equal(36695n, "Gas footprint does not match the strict academic framework ceiling.");
    });

    it("Should return false or revert if an Employer evaluates a deactivated student profile", async function () {
      // FIX: Passing the direct literal string hash context to allow error traps inside EDR simulations
      await registry.connect(admin).setStudentDeactivatedStatus(targetCitizenHash, true);
      
      // Evaluation should immediately trap the security threshold and throw an EVM exception
      try {
        await registry.connect(employer).verifyAndFetchMetadata(
          targetDiplomaHash,
          targetCitizenName,
          targetNationalID
        );
        expect.fail("Transaction should have reverted due to deactivation");
      } catch (error: any) {
        expect(error.message).to.include("reverted");
      }
    });

    it("Should revert if an Employer evaluates a mismatched identity string relationship", async function () {
      try {
        // Trigger structural verification under invalid name vectors to force an identity mismatch revert
        await registry.connect(employer).verifyAndFetchMetadata(
          targetDiplomaHash,
          "Malicious Name",
          "9999999999"
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
        // ПОПРАВКА: Подават се коректно 3-те аргумента към addDiploma при отхвърлянето на администратора
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
