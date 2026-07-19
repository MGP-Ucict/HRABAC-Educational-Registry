// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PureABAC {
    struct DiplomaAttributes {
        bytes32 diplomaHash;
        string issuingInstitution;
        bool IsActive;
    }

    struct SubjectAttributes {
        string subjectRole;        // напр. "Employer", "Inspector"
        string subjectInstitution; // напр. "Ministry_Of_Education"
    }

    DiplomaAttributes[] public diplomas;
    mapping(address => SubjectAttributes) public subjectRegistry;
    address public admin;

    constructor() {
        admin = msg.sender;
    }

    function registerSubjectAttributes(address _subject, string memory _role, string memory _inst) external {
        require(msg.sender == admin, "Only admin");
        subjectRegistry[_subject] = SubjectAttributes(_role, _inst);
    }

    function addDiploma(string memory _inst, bytes32 _hash) external {
        require(msg.sender == admin, "Only admin");
        diplomas.push(DiplomaAttributes(_hash, _inst, true));
    }

    /**
     * @notice ABAC верификация с O(n) сложност.
     * @dev EVM е принуден да сравнява стрингови атрибути в динамичен цикъл.
     */
    function verifyDiplomaABAC(bytes32 _targetHash) external returns (bool) {
        SubjectAttributes memory subAttr = subjectRegistry[msg.sender];
        
        // ABAC Правило: Само субекти с роля "Employer" или от същата институция имат право да четат
        require(
            keccak256(abi.encodePacked(subAttr.subjectRole)) == keccak256(abi.encodePacked("Employer")),
            "ABAC Denied: Invalid Subject Role"
        );

        uint256 total = diplomas.length;
        for (uint256 i = 0; i < total; i++) {
            if (diplomas[i].diplomaHash == _targetHash) {
               return true;
            }
        }
        return false;
    }
}
