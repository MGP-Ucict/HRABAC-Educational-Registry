// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PureABAC
 * @notice Legacy Attribute-Based Access Control model used as a benchmark baseline.
 * @dev Enforces access policies through dynamic loops, inducing a volatile linear O(n) complexity profile.
 */
contract PureABAC {
    struct DiplomaAttributes {
        bytes32 diplomaHash;
        string issuingInstitution;
        bool IsActive;
    }

    struct SubjectAttributes {
        string subjectRole;        // e.g., "Employer", "Inspector"
        string subjectInstitution; // e.g., "Ministry_Of_Education"
    }

    // Dynamic storage layout susceptible to volume-induced gas exhaustion
    DiplomaAttributes[] public diplomas;
    mapping(address => SubjectAttributes) public subjectRegistry;
    address public admin;

    constructor() {
        admin = msg.sender;
    }

    /**
     * @notice Registers security attributes for a specific network subject.
     */
    function registerSubjectAttributes(address _subject, string memory _role, string memory _inst) external {
        require(msg.sender == admin, "Only admin");
        subjectRegistry[_subject] = SubjectAttributes(_role, _inst);
    }

    /**
     * @notice Pushes a new credential record to the linear storage array.
     */
    function addDiploma(string memory _inst, bytes32 _hash) external {
        require(msg.sender == admin, "Only admin");
        diplomas.push(DiplomaAttributes(_hash, _inst, true));
    }

    /**
     * @notice ABAC verification checkpoint demonstrating O(n) algorithmic decay.
     * @dev Forces full EVM execution loop state traversals to find a matching token index.
     * @param _targetHash The cryptographic identifier of the target credential being evaluated.
     * @return bool True if authorized and object exists, false otherwise.
     */
    function verifyDiplomaABAC(bytes32 _targetHash) external returns (bool) {
        SubjectAttributes memory subAttr = subjectRegistry[msg.sender];
        
        // ABAC Policy Invariant Check: Restricts evaluation to verified "Employer" identities
        // Performs expensive string hashing operation to establish semantic context
        require(
            keccak256(abi.encodePacked(subAttr.subjectRole)) == keccak256(abi.encodePacked("Employer")),
            "ABAC Denied: Invalid Subject Role"
        );

        // Linear O(n) execution path traversing the entire database array volume
        uint256 total = diplomas.length;
        for (uint256 i = 0; i < total; i++) {
            if (diplomas[i].diplomaHash == _targetHash) {
               return true; // Execution overhead scales proportionally with data array depth
            }
        }
        return false;
    }
}
