import { expect } from "chai";
import hre  from "hardhat";
const { ethers } = await hre.network.create(); 

describe("Gas Benchmark O(1)", function () {
  let registry;
  let admin, inspector, employer, student1;

  beforeEach(async function () {
    // Вземаме тестовите акаунти от Hardhat
    [admin, inspector, employer, student1] = await ethers.getSigners();

    // 1. Деплойваме вашия контракт (заменете името с истинското, ако е различно)
    const RegistryFactory = await ethers.getContractFactory("HRABACEducationalRegistry");
    registry = await RegistryFactory.deploy(inspector);
    await registry.waitForDeployment();
    await registry.connect(admin).registerInspector(employer.address, 50005);
    await registry.connect(inspector).registerEmployer(employer.address, 40004);
  });

  it("Should prove O(1) complexity by checking gas cost with increasing data volume", async function () {
    // Дефинираме стъпките за натоварване: 5, 10 и 20 дипломи в системата
    const dataSizes = [5, 10, 20]; 
    let lastGasUsed = null;

    // Генерираме РЕФЕРЕНТНАТА ДИПЛОМА, която ще проверяваме всеки път.
    // Тя ще бъде закотвена в базата данни от самото начало.
    const targetStudent = student1.address;
    const targetHash = ethers.id("Target_Academic_Diploma_2026");
    
    // Записваме я като първи запис (Базова линия)
    await registry.connect(inspector).addDiploma(targetStudent, targetHash);

    console.log("\n--- START GAS BENCHMARK ---");

    for (let size of dataSizes) {
      // 1. Изчисляваме колко "фалшиви" дипломи трябва да добавим, за да достигнем текущия размер (size)
      // Намаляваме с 1, защото референтната диплома вече е вътре.
      const currentCount = Number(1); 
      const itemsToAdd = size - currentCount;

      // 2. Натрупваме обем от данни в Storage (Изкуствено раздуване на мапинга)
      for (let i = 0; i < itemsToAdd; i++) {
        const fakeStudentWallet = ethers.Wallet.createRandom(); 
        const fakeHash = ethers.id(`Fake_Diploma_ID_${size}_${i}`); 
        await registry.connect(inspector).addDiploma(fakeStudentWallet.address, fakeHash);
      }

      // 3. ОФИЦИАЛНОТО ИЗМЕРВАНЕ: Извикваме проверката на ОРИГИНАЛНАТА диплома
      // Тъй като verifyDiploma е view функция, за да генерираме реална разписка (Receipt) с газ,
      // я извикваме през изпращане на трансакция (или ползваме estimateGas). 
      // Изпращането като трансакция е най-сигурният начин да вземем точния EVM изпълнителен газ.
      const tx = await registry.connect(employer).verifyDiploma(targetStudent, targetHash);
      const receipt = await tx.wait();
      
      const gasUsed = receipt.gasUsed;
      console.log(`Data Volume: ${size} diplomas in DB | Gas Used for verification: ${gasUsed.toString()} gas`);

      // 4. НАУЧНА ПРОВЕРКА (Assertion): 
      // Проверяваме дали газът при N=20 е ЕДНАКЪВ с този при N=5
      if (lastGasUsed !== null) {
        expect(gasUsed).to.equal(lastGasUsed);
      }
      lastGasUsed = gasUsed;
    }
    
    console.log("--- END GAS BENCHMARK ---\n");
    console.log(`📊 Научно доказателство: Тъй като делтата на газа е 0, сложността е твърдо O(1).`);
  });
});
