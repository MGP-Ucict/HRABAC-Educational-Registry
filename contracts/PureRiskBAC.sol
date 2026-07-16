// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PureRiskBAC {
    struct DiplomaRecord {
        bytes32 diplomaHash;
        address studentAddress;
        uint256 requiredSecurityClearance; // Изисквано ниво на сигурност (напр. 1 до 100)
    }

    mapping(bytes32 => DiplomaRecord) public registry;
    
    // Динамични променливи за риск
    mapping(address => uint256) public failedAttempts;
    mapping(address => uint256) public userReputationScore; // 100 е перфектна репутация
    
    address public inspector;

    constructor() {
        inspector = msg.sender;
        userReputationScore[msg.sender] = 100;
    }

    function addDiploma(bytes32 _hash, address _student, uint256 _clearance) external {
        require(msg.sender == inspector, "Only inspector");
        registry[_hash] = DiplomaRecord(_hash, _student, _clearance);
    }

    /**
     * @notice Risk-BAC верификация. Сложността се усложнява от динамичната оценка на риска.
     * @dev Изчислява математически риск коефициент при всяко повикване, което вдига базовата цена на газ.
     */
    function verifyDiplomaRiskBAC(bytes32 _hash, address _student) external returns (bool) {
        DiplomaRecord memory record = registry[_hash];
        //require(record.studentAddress == _student, "Record mismatch");

        // Динамично изчисляване на текущия риск на проверяващия субект
        // Рискът расте с броя грешни опити и пада при висока репутация
        uint256 currentRiskScore = (failedAttempts[msg.sender] * 20) + (100 - userReputationScore[msg.sender]);

        // Risk-BAC Правило: Ако рискът надвишава лимита за сигурност на документа, достъпът се отказва
        if (currentRiskScore > (100 - record.requiredSecurityClearance)) {
            failedAttempts[msg.sender] += 1; // Рискът се покачва автоматично при провал
            return false; // Достъпът е блокиран поради висок риск
        }

        // Ако проверката е успешна, репутацията се подобрява леко
        if (userReputationScore[msg.sender] < 100) {
            userReputationScore[msg.sender] += 1;
        }
        return true;
    }
}
