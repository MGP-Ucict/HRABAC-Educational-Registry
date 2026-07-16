import { expect } from "chai";
import hre  from "hardhat";
const { ethers } = await hre.network.create(); 

describe("🛑 Демонстрация на критичен срив и Газ DoS лимит", function () {
  let abac, riskBac, hrabac;
  let admin, employer, student;

  // ДЕФИНИРАНЕ НА КРИТИЧЕН ЛИМИТ ЗА СИГУРНОСТ
  // В реалния Ethereum лимитът за цял блок е 30,000,000. 
  // За нуждите на нашия лабораторен тест, поставяме критичен праг за една функция: 120,000 газ.
  const CRITICAL_GAS_THRESHOLD = 120000; 

  beforeEach(async function () {
    [admin, employer, student] = await ethers.getSigners();

    abac = await (await ethers.getContractFactory("PureABAC")).deploy(admin);
    riskBac = await (await ethers.getContractFactory("PureRiskBAC")).deploy(admin);
    hrabac = await (await ethers.getContractFactory("HRABACEducationalRegistry")).deploy(admin);

    await abac.waitForDeployment();
    await riskBac.waitForDeployment();
    await hrabac.waitForDeployment();
    await hrabac.connect(admin).registerEmployer(employer.address, 50005);
    await hrabac.connect(admin).registerGraduate(student.address, 40004);
    // Първоначална авторизация
    await abac.connect(admin).registerSubjectAttributes(employer.address, "Employer", "MoE");
  });

  // ------------------------------------------------------------------
  // ДЕМОНСТРАЦИЯ 1: Как PureRiskBAC спира да работи (Логическо блокиране)
  // ------------------------------------------------------------------
  it("PureRiskBAC спира да работи за потребителя след 5 грешни стъпки", async function () {
    const targetHash = ethers.id("Real_Diploma_Hash");
    const wrongHash = ethers.id("Wrong_Diploma_Hash");
    await riskBac.connect(admin).addDiploma(targetHash, student.address, 20);
    console.log("\n--- СИМУЛАЦИЯ НА СРИВ В RISKBAC ---");

    for (let i = 1; i <= 5; i++) {
      const tx = await riskBac.connect(employer).verifyDiplomaRiskBAC(wrongHash, student.address);
      await tx.wait();
      console.log(`❌ Грешен опит #${i} регистриран в блокчейна.`);
    }

    console.log("➡️ Опит за проверка на ИСТИНСКАТА диплома след натрупания риск...");
    
    const accessResult = await riskBac.connect(employer).verifyDiplomaRiskBAC.staticCall(targetHash, student.address);
    console.log(`🚨 Резултат от проверката на истинската диплома: ${accessResult ? "РАБОТИ" : "БЛОКИРАН (Логически срив)"}`);
    
    expect(accessResult).to.be.false; 
  });

  // ------------------------------------------------------------------
  // ДЕМОНСТРАЦИЯ 2: Как PureABAC блокира заради Газ Експлозия (O(n) DoS)
  // ------------------------------------------------------------------
  it("PureABAC преминава критичния лимит на сигурност и хвърля автоматична грешка", async function () {
    const targetHash = ethers.id("Target_Hash_ABAC");
    await abac.connect(admin).addDiploma(targetHash, "MoE");

    console.log("\n--- СИМУЛАЦИЯ НА ГАЗ ЕКСПЛОЗИЯ В PUREABAC ---");
    
    // Постепенно добавяме 350 записа в масива, за да натоварим цикъла и да преминем прага
    const recordsToInject = 350; 
    console.log(`⏳ Инжектиране на ${recordsToInject} дипломи за раздуване на масива в PureABAC...`);
    
    for (let i = 0; i < recordsToInject; i++) {
      // Добавяме записи бързо на партиди
      await abac.connect(admin).addDiploma(ethers.id(`Fake_${i}`), "Other");
    }

    // Измерваме газа след умишленото натоварване
    const finalGasABAC = Number(await abac.connect(employer).verifyDiplomaABAC.estimateGas(targetHash));
    console.log(`⛽ Текущ разход на газ за PureABAC: ${finalGasABAC} units`);
    console.log(`🛡️ Зададен критичен праг за сигурност: ${CRITICAL_GAS_THRESHOLD} units`);

    // АВТОМАТИЧНА СОФТУЕРНА ПРОВЕРКА ЗА СРИВ
    if (finalGasABAC > CRITICAL_GAS_THRESHOLD) {
      console.log(`\n🛑 [КРИТИЧНА ГРЕШКА]: Трансакцията в PureABAC беше ПРЕКЪСНАТА автоматично!`);
      console.log(`⚠️ Причина: Разходът от ${finalGasABAC} газ надвиши лимита от ${CRITICAL_GAS_THRESHOLD}.`);
      console.log(`💀 Системата е уязвима на Block Gas Limit Denial of Service (DoS) атака!`);
      
      // Хвърляме официален Chai Fail, за да счупим теста и да го демонстрираме нагледно
      expect.fail(`PureABAC Gas Exhaustion detected: ${finalGasABAC} > ${CRITICAL_GAS_THRESHOLD}`);
    }

    expect(finalGasABAC).to.be.lessThan(CRITICAL_GAS_THRESHOLD);
  });

  // ------------------------------------------------------------------
  // ДЕМОНСТРАЦИЯ 3: Как HRABAC остава имунизиран при същите условия
  // ------------------------------------------------------------------
  it("HRABAC остава стабилен под същия обем натоварване без промяна в газа", async function () {
    const targetHash = ethers.id("Target_Hash_HRABAC");
    await hrabac.connect(admin).addDiploma(student.address, targetHash);

    console.log("\n--- ПРОВЕРКА НА СТАБИЛНОСТТА НА HRABAC ---");
    
    // Добавяме абсолютно същия брой (350) фалшиви записи в HRABAC
    for (let i = 0; i < 350; i++) {
      await hrabac.connect(admin).addDiploma(ethers.Wallet.createRandom().address, ethers.id(`Fake_HR_${i}`));
    }

    const gasHRABAC = Number(await hrabac.connect(employer).verifyDiploma.estimateGas(student.address, targetHash));
    console.log(`🟩 Разход на газ за HRABAC след натоварването: ${gasHRABAC} units`);
    console.log(`🎯 Статус: Имунизиран срещу DoS. Разходът е далеч под критичния праг.`);

    // Проверяваме дали HRABAC е преминал теста успешно
    expect(gasHRABAC).to.be.lessThan(CRITICAL_GAS_THRESHOLD);
  });
});
