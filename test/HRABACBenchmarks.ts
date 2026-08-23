import { expect } from "chai";
import hre from "hardhat"; 

describe("RegHRABACEducationalRegistry - Gas Benchmark O(1)", function () {
  let registry: any;
  let admin: any, inspector: any, employer: any;
  let ethersCtx: any; 

  beforeEach(async function () {
    const connection = await hre.network.create();
    ethersCtx = connection.ethers;

    const signers = await ethersCtx.getSigners();
    [admin, inspector, employer] = signers; 

    const RegistryFactory = await ethersCtx.getContractFactory("RegHRABACEducationalRegistry");
    registry = await RegistryFactory.deploy(admin.address); 
    await registry.waitForDeployment();
    
    await registry.connect(admin).registerInspector(inspector.address);
  });

  it("Should prove O(1) complexity by checking gas cost with increasing data volume", async function () {
    // Array specifying the data points to evaluate nationwide infrastructure scale inflation
    const dataSizes = [1, 10, 50, 100, 200, 1000, 10000]; 
    let lastGasUsed: bigint | null = null;
    this.timeout(480000); // 8-minute safety window for high volume generation
    
    const targetDiplomaHash = ethersCtx.id("Target_Academic_Diploma_2026");
    
    const packedSecretBytes = ethersCtx.concat([
      ethersCtx.toUtf8Bytes("John Doe"),
      ethersCtx.toUtf8Bytes("004515XXXX")
    ]);
    const targetCitizenHash = ethersCtx.keccak256(packedSecretBytes);
    
    const initialEpochRoot = ethersCtx.id("Initial_Epoch_Root_000");
    
    // Seed database with the legitimate target record using exactly 3 arguments (Zero-PII Architecture)
    await registry.connect(inspector).emitEpochState(
      initialEpochRoot, 
      [targetDiplomaHash], 
      [targetCitizenHash]
    );

    console.log("\n--- START GAS BENCHMARK ---");

    let currentCount = 1; 

    for (let size of dataSizes) {
      let itemsToAdd = size - currentCount;

      // Split large scale emissions into safe sub-batches to prevent Block Gas Limit anomalies
      const CHUNK_SIZE = 100;
      let batchCounter = 0;

      while (itemsToAdd > 0) {
        const currentChunkSize = Math.min(itemsToAdd, CHUNK_SIZE);
        const fakeDiplomaHashes: string[] = [];
        const fakeCitizenHashes: string[] = [];
        const loopEpochRoot = ethersCtx.id(`Epoch_Root_Size_${size}_Batch_${batchCounter}`);

        for (let i = 0; i < currentChunkSize; i++) {
          // Generate unique identities per block entry
          fakeDiplomaHashes.push(ethersCtx.id(`Fake_Diploma_Hash_${size}_${currentCount}_${i}`));
          fakeCitizenHashes.push(ethersCtx.id(`Fake_Citizen_Hash_${size}_${currentCount}_${i}`));
        }

        // Commit safe segmented slice to the EVM state using the correct 3-parameter signature
        const tx = await registry.connect(inspector).emitEpochState(
          loopEpochRoot,
          fakeDiplomaHashes,
          fakeCitizenHashes
        );
        await tx.wait();

        itemsToAdd -= currentChunkSize;
        currentCount += currentChunkSize;
        batchCounter++;
      }

      // Execute static view evaluation check - This remains perfectly flat O(1)
      const gasUsed: bigint = await registry
        .connect(employer)
        .getFunction("verifyDiploma")
        .estimateGas(
          targetDiplomaHash, 
          targetCitizenHash
        );
      
      console.log(`Data Volume: ${size} diplomas in DB | Gas Used for verification: ${gasUsed.toString()} gas`);

      if (lastGasUsed !== null) {
        expect(gasUsed).to.equal(lastGasUsed, "Gas footprint mutated! Code does not exhibit strict O(1) properties.");
      }
      
      // Asserts that the verification path respects the strict academic framework flat ceiling
      expect(gasUsed).to.equal(29334n, "Gas execution profile deviated from the designated flat ceiling.");
      
      lastGasUsed = gasUsed;
    }
    
    console.log("--- END GAS BENCHMARK ---\n");
    console.log(`📊 Empirical Proof: Since the gas delta is exactly 0 across all storage volumes,\n algorithmic complexity is strictly O(1).`);
  });
});
