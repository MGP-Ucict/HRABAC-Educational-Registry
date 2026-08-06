// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HRABAC Educational Registry Smart Contract (Production-Grade & Optimized)
 * @notice Implements a dynamic, challenge-free and linkability-free educational verification layer.
 * @dev Discards loops and dynamic lookup arrays to achieve absolute algorithmic immunity against gas explosion attacks.
 */
contract HRABACEducationalRegistry {

    // Enums matching system operator roles. None (0) serves as an uninitialized marker.
    enum Role { None, Admin, Inspector, Employer }

    // Lightweight custom errors replacing expensive revert string literals
    error UnauthorizedAccess();
    error ZeroAddressDetected();
    error UserDoesNotExist();
    error AdminCannotSelfDeactivate();
    error InvalidAdministrativeAssignment();
    error DiplomaAlreadyRegistered();
    error IdentityMismatchOrRecordNotFound();

    struct UserProfile {  
        Role role;         
        bool isActive;     
    }

    struct DiplomaRegistry {
        bytes32 citizenHash;       // keccak256(studentName || nationalID/EGN)
        string encryptedMetadata;  // Symmetrically encrypted off-chain payload (University, Major, Grades)
    }

    // --- IMMUTABLE STORAGE LAYOUT ---
    // Slot 0: Maps system operator blockchain addresses to their structural roles and states
    mapping(address => UserProfile) public users;
    
    // Slot 1: Secure registry mapping distinct diploma hashes to their credential payload structures
    mapping(bytes32 => DiplomaRegistry) private registries;

    // Slot 2: Lifecycle tracking registry specifically managed for individual citizen deactivation
    mapping(bytes32 => bool) private studentDeactivated;

    event UserRegistered(address indexed userAddress, Role role);
    event RoleStatusChanged(address indexed userAddress, string roleType, bool isActive, uint256 timestamp);
    event StudentStatusChanged(bytes32 indexed citizenHash, bool isDeactivated, uint256 timestamp);
    event DiplomaAdded(bytes32 indexed diplomaHash, bytes32 indexed citizenHash, uint256 timestamp);

    // High-performance clean Solidity modifier validating caller blockchain address attributes
    modifier onlyActiveRole(Role _requiredRole) {
        UserProfile memory profile = users[msg.sender];
        if (profile.role != _requiredRole || !profile.isActive) {
            revert UnauthorizedAccess();
        }
        _;
    }

    /**
     * @notice Initializes the central registry configuration framework establishing the root Administrator.
     * @param _admin The primary system blockchain operator address.
     */
    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddressDetected();
        
        users[_admin] = UserProfile({
            role: Role.Admin,
            isActive: true
        });
        emit UserRegistered(_admin, Role.Admin);
    }

    // --- Technical Administrative Core ---

    /**
     * @notice Provisions a new authorized Inspector profile inside the registry map.
     * @param _inspector The contract address assigned to the new Inspector entity.
     */
    function registerInspector(address _inspector) external onlyActiveRole(Role.Admin) {
        if (_inspector == address(0)) revert ZeroAddressDetected();
        
        users[_inspector] = UserProfile({
            role: Role.Inspector,
            isActive: true
        });
        
        emit UserRegistered(_inspector, Role.Inspector);
    }

    /**
     * @notice Activates or deactivates a targeted system operator entity account profile.
     * @param _userAddress The operator account address undergoing parameter mutations.
     * @param _status The target Boolean lifecycle flag configuration state.
     */
    function setUserActiveStatus(address _userAddress, bool _status) external onlyActiveRole(Role.Admin) {
        UserProfile storage profile = users[_userAddress];
        if (profile.role == Role.None) revert UserDoesNotExist();
        if (_userAddress == msg.sender) revert AdminCannotSelfDeactivate();
        
        profile.isActive = _status;
        
        string memory roleLabel;
        Role r = profile.role;
        if (r == Role.Employer) roleLabel = "Employer";
        else if (r == Role.Inspector) roleLabel = "Inspector";
        else roleLabel = "Admin";

        emit RoleStatusChanged(_userAddress, roleLabel, _status, block.timestamp);
    }

    /**
     * @notice Soft-locks or un-locks a role-free citizen node identity to support dynamic privacy requirements.
     * @param _citizenHash The deterministic unique 32-byte cryptographic token hash of the citizen.
     * @param _deactivate True to lock out data verification; False to re-enable it.
     */
    function setStudentDeactivatedStatus(bytes32 _citizenHash, bool _deactivate) external onlyActiveRole(Role.Admin) {
        if (_citizenHash == bytes32(0)) revert IdentityMismatchOrRecordNotFound();
        studentDeactivated[_citizenHash] = _deactivate;
        emit StudentStatusChanged(_citizenHash, _deactivate, block.timestamp);
    }

    // --- Business / Academic Core ---

    /**
     * @notice Onboards an external Employer entity allowing them to verify records against the registry view layer.
     * @param _employer The public wallet address of the validated verification entity.
     */
    function registerEmployer(address _employer) external onlyActiveRole(Role.Inspector) {
        if (_employer == address(0)) revert ZeroAddressDetected();
        users[_employer] = UserProfile({
            role: Role.Employer,
            isActive: true
        });
        emit UserRegistered(_employer, Role.Employer);
    }

    /**
     * @notice Securely registers a new diploma asset entry inside the flat mapping storage tier.
     * @param _diplomaHash The unique document hash identifier (acts as the symmetric key for off-chain decryption).
     * @param _citizenHash The deterministic cryptographic identity anchor (keccak256 of Name + EGN).
     * @param _encryptedMetadata The symmetrically encrypted off-chain string containing the document properties.
     */
    function addDiploma(
        bytes32 _diplomaHash, 
        bytes32 _citizenHash, 
        string calldata _encryptedMetadata
    ) external onlyActiveRole(Role.Inspector) {
        if (_diplomaHash == bytes32(0) || _citizenHash == bytes32(0)) revert IdentityMismatchOrRecordNotFound();
        if (registries[_diplomaHash].citizenHash != bytes32(0)) revert DiplomaAlreadyRegistered();

        registries[_diplomaHash] = DiplomaRegistry({
            citizenHash: _citizenHash,
            encryptedMetadata: _encryptedMetadata
        });

        emit DiplomaAdded(_diplomaHash, _citizenHash, block.timestamp);
    }

    // --- Clean View Verification Layer ---

    /**
     * @notice High-performance zero-overhead validation engine in pure Solidity.
     * @dev Achieves absolute O(1) complexity and immunity against gas explosion.
     * @param _diplomaHash The unique cryptographic document identifier.
     * @param _calculatedCitizenHash The pre-computed identity anchor validation token.
     * @return The symmetrically encrypted off-chain payload string.
     */
    function verifyAndFetchMetadata(
        bytes32 _diplomaHash, 
        bytes32 _calculatedCitizenHash
    ) external view returns (string memory) {
        
        if (_diplomaHash == bytes32(0) || _calculatedCitizenHash == bytes32(0)) {
            revert IdentityMismatchOrRecordNotFound();
        }

        if (studentDeactivated[_calculatedCitizenHash]) {
            revert IdentityMismatchOrRecordNotFound();
        }

        // Direct look-up in storage - O(1) complexity guaranteed by the EVM mapping layout
        DiplomaRegistry memory record = registries[_diplomaHash];

        // The 2-Hash Comparison Gate directly enforced
        if (record.citizenHash == bytes32(0) || record.citizenHash != _calculatedCitizenHash) {
            revert IdentityMismatchOrRecordNotFound();
        }

        // Enforce RBAC validation gate for the caller profile attributes
        UserProfile memory callerProfile = users[msg.sender];
        if (!callerProfile.isActive || (
            callerProfile.role != Role.Admin && 
            callerProfile.role != Role.Inspector && 
            callerProfile.role != Role.Employer
        )) {
            revert UnauthorizedAccess();
        }

        return record.encryptedMetadata;
    }
}
