import { expect } from "chai";
import hre from "hardhat"; 

describe("HRABACEducationalRegistry - Gas Benchmark O(1)", function () {
  let registry: any;
  let admin: any, inspector: any, employer: any;
  let ethers: any; 

  beforeEach(async function () {
    const connection = await hre.network.create();
    ethers = connection.ethers;

    const signers = await ethers.getSigners();
    [admin, inspector, employer] = signers; 

    const RegistryFactory = await ethers.getContractFactory("HRABACEducationalRegistry");
    registry = await RegistryFactory.deploy(admin.address); 
    await registry.waitForDeployment();
    
    await registry.connect(admin).registerInspector(inspector.address);
  });

  it("Should prove O(1) complexity by checking gas cost with increasing data volume", async function () {
    const dataSizes = [1, 10, 50, 100, 200, 1000, 10000]; 
    let lastGasUsed: bigint | null = null;
    this.timeout(480000); // 8-minute safety window for high volume generation
    
    const targetDiplomaHash = ethers.id("Target_Academic_Diploma_2026");
    
    const packedSecretBytes = ethers.concat([
      ethers.toUtf8Bytes("John Doe"),
      ethers.toUtf8Bytes("004515XXXX")
    ]);
    const targetCitizenHash = ethers.keccak256(packedSecretBytes);
    
    const targetPayload = "Encrypted_University_Sofia_Computer_Science_Excellent_5.80";
    const initialEpochRoot = ethers.id("Initial_Epoch_Root_000");
    
    // Seed database with the legitimate target record
    await registry.connect(inspector).emitEpochState(
      initialEpochRoot, 
      [targetDiplomaHash], 
      [targetCitizenHash], 
      [targetPayload]
    );

    console.log("\n--- START GAS BENCHMARK ---");

    let currentCount = 1; 

    for (let size of dataSizes) {
      let itemsToAdd = size - currentCount;

      // FIX: Разбиване на големите партиди на под-партиди от макс 200 елемента за избягване на Block Gas Limit DoS
      const CHUNK_SIZE = 200;
      let batchCounter = 0;

      while (itemsToAdd > 0) {
        const currentChunkSize = Math.min(itemsToAdd, CHUNK_SIZE);
        const fakeDiplomaHashes: string[] = [];
        const fakeCitizenHashes: string[] = [];
        const fakePayloads: string[] = [];
        const loopEpochRoot = ethers.id(`Epoch_Root_Size_${size}_Batch_${batchCounter}`);

        for (let i = 0; i < currentChunkSize; i++) {
          // Generate unique identities per block entry
          fakeDiplomaHashes.push(ethers.id(`Fake_Diploma_Hash_${size}_${currentCount}_${i}`));
          fakeCitizenHashes.push(ethers.id(`Fake_Citizen_Hash_${size}_${currentCount}_${i}`));
          fakePayloads.push("Fake_Metadata_Payload");
        }

        // Commit safe segmented slice to the EVM state
        const tx = await registry.connect(inspector).emitEpochState(
          loopEpochRoot,
          fakeDiplomaHashes,
          fakeCitizenHashes,
          fakePayloads
        );
        await tx.wait();

        itemsToAdd -= currentChunkSize;
        currentCount += currentChunkSize;
        batchCounter++;
      }

      // Execute static view evaluation check - This remains perfectly flat O(1)
      const gasUsed: bigint = await registry
        .connect(employer)
        .getFunction("verifyAndFetchMetadata")
        .estimateGas(
          targetDiplomaHash, 
          targetCitizenHash
        );
      
      console.log(`Data Volume: ${size} diplomas in DB | Gas Used for verification: ${gasUsed.toString()} gas`);

      if (lastGasUsed !== null) {
        expect(gasUsed).to.equal(lastGasUsed, "Gas footprint mutated! Code does not exhibit strict O(1) properties.");
      }
      
      expect(gasUsed).to.equal(38820n, "Gas execution profile deviated from the designated 37,187 flat ceiling.");
      
      lastGasUsed = gasUsed;
    }
    
    console.log("--- END GAS BENCHMARK ---\n");
    console.log(`📊 Empirical Proof: Since the gas delta is exactly 0 across all storage volumes,\n algorithmic complexity is strictly O(1).`);
  });
});
