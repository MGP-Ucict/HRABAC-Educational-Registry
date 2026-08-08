// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PureABAC {
    enum Role { None, Admin, Inspector, Employer }

    struct UserProfile {  
        Role role;         
        bool isActive;     
    }

    struct SubjectAttributes {
        string subjectRole;
        string subjectInstitution;
    }

    struct DiplomaAttributes {
        bytes32 diplomaHash;
        bytes32 citizenHash;
        string issuingInstitution;
        string encryptedMetadata;
    }

    mapping(address => UserProfile) public users;
    mapping(address => SubjectAttributes) public subjectRegistry;
    DiplomaAttributes[] public diplomas;
    
    uint256 public loopCounter;
    address public admin;

    error UnauthorizedAccess();
    error IdentityMismatchOrRecordNotFound();

    constructor(address _admin) {
        admin = _admin;
        users[_admin] = UserProfile({role: Role.Admin, isActive: true});
    }

    function registerSubjectAttributes(address _subject, string memory _role, string memory _inst) external {
        require(msg.sender == admin, "Only admin");
        subjectRegistry[_subject] = SubjectAttributes(_role, _inst);
        
        Role mappedRole = Role.None;
        if (keccak256(abi.encodePacked(_role)) == keccak256(abi.encodePacked("Employer"))) mappedRole = Role.Employer;
        if (keccak256(abi.encodePacked(_role)) == keccak256(abi.encodePacked("Inspector"))) mappedRole = Role.Inspector;
        
        users[_subject] = UserProfile({role: mappedRole, isActive: true});
    }

    function addDiploma(bytes32 _hash, bytes32 _citizenHash, string memory _inst, string memory _metadata) external {
        diplomas.push(DiplomaAttributes(_hash, _citizenHash, _inst, _metadata));
    }

    /**
     * @notice Reference ABAC function WITHOUT "view" modifier, forcing a state change in EVM for O(n) measurement.
     */
    function verifyDiplomaABAC(bytes32 _targetHash, bytes32 _calculatedCitizenHash) external returns (string memory) {
        SubjectAttributes memory subAttr = subjectRegistry[msg.sender];
        
        require(
            keccak256(abi.encodePacked(subAttr.subjectRole)) == keccak256(abi.encodePacked("Employer")),
            "ABAC Denied: Invalid Subject Role"
        );

        uint256 total = diplomas.length;
        for (uint256 i = 0; i < total; i++) {
            loopCounter = i; 

            if (diplomas[i].diplomaHash == _targetHash) {
                if (diplomas[i].citizenHash != _calculatedCitizenHash) {
                    revert IdentityMismatchOrRecordNotFound();
                }
                return diplomas[i].encryptedMetadata;
            }
        }
        revert IdentityMismatchOrRecordNotFound();
    }
}
