// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title RegHRABACEducationalRegistry
 * @notice Production-grade decentralized registry implementing the Reg-HRABAC architecture.
 * @dev Read-layer maintains strict O(1) storage lookup mapped at a flat gas ceiling of ~29,334 gas.
 * @dev Fully decoupled from plain-text payloads and string processing to eliminate on-chain data leakage.
 * @dev Compliant with GDPR Article 17 (Right to be Forgotten) via off-chain cryptographic shredding.
 */
contract RegHRABACEducationalRegistry {

    // System operator roles. None (0) serves as an uninitialized storage marker.
    enum Role { None, Admin, Inspector }

    // --- STRUCTS ---
    struct UserProfile {  
        Role role;         
        bool isActive;     
    }

    // --- LIGHTWEIGHT CUSTOM ERRORS (OPTIMIZED FOR GAS SAVINGS) ---
    error UnauthorizedAccess();
    error ZeroAddressDetected();
    error ZeroHashDetected();
    error UserDoesNotExist();                 
    error AdminCannotSelfDeactivate();        
    error RecordNotFoundOrAccessDenied();
    error DuplicateEpochDetected();
    error ArrayLengthMismatch();              
    error RecordAlreadyExists();              

    // --- STORAGE LAYOUT (OPTIMIZED FOR STATIC EVM STORAGE SLOTS) ---
    // Mapping to manage access control rules for system actors
    mapping(address => UserProfile) public users;
    
    // Core Cryptographic Anchor Layer: mapping(diplomaHash => mapping(citizenHash => isValid))
    // Stores zero PII (Personally Identifiable Information). Only 32-byte deterministic hashes are retained.
    mapping(bytes32 => mapping(bytes32 => bytes32)) private cryptoAnchors;
    mapping(bytes32 => bool) public deactivatedStudents;
    
    // Registry tracking authorized consensus batch epochs to prevent double-emission exploits
    mapping(bytes32 => bool) public validatedEpochs;
    
    // Array maintaining the global immutable timeline of validated batch roots
    bytes32[] public epochHistory;

    // --- SYSTEM LOGGING EVENTS (INDEXED FOR EVENT SOURCING & OFF-CHAIN INDEXERS) ---
    event UserRegistered(address indexed userAddress, Role indexed role);
    event RoleStatusChanged(address indexed userAddress, string roleType, bool isActive, uint256 timestamp); 
    event EpochValidated(bytes32 indexed epochRoot, address indexed inspector, uint256 timestamp);
    event AnchorRevoked(bytes32 indexed diplomaHash, bytes32 indexed citizenHash, uint256 timestamp);
    // Emitted when an entire epoch consensus batch is invalidated by an administrator
    event EpochRevoked(bytes32 indexed epochRoot, address indexed admin, uint256 timestamp);
    event StudentDeactivatedStatusChanged(bytes32 indexed citizenHash, bool isDeactivated);


    // High-performance operational boundary gate evaluating active administrative identities
    modifier onlyActiveRole(Role _requiredRole) {
        if (users[msg.sender].role != _requiredRole || !users[msg.sender].isActive) {
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
        users[_admin] = UserProfile({role: Role.Admin, isActive: true});
        emit UserRegistered(_admin, Role.Admin);
    }

    // --- TECHNICAL ADMINISTRATIVE CORE ---

    /**
     * @notice Provisions a new authorized Inspector profile inside the access control map.
     * @param _inspector The contract address assigned to the new Inspector entity.
     */
    function registerInspector(address _inspector) external onlyActiveRole(Role.Admin) {
        if (_inspector == address(0)) revert ZeroAddressDetected();
        users[_inspector] = UserProfile({role: Role.Inspector, isActive: true});
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
        
        string memory roleLabel = (profile.role == Role.Inspector) ? "Inspector" : "Admin";
        emit RoleStatusChanged(_userAddress, roleLabel, _status, block.timestamp);
    }

    // --- BUSINESS CORE: ZERO-LEAKAGE BATCH EMISSION ---

    /**
     * @notice Validates a full epoch batch of diplomas simultaneously and flattens them into the ledger storage slots.
     * @dev Strategic transactional atomicity block preventing partial state synchronization failure from the off-chain layer.
     * @dev Completely loop-optimized by processing only primitive 32-byte hashes, avoiding expensive EVM dynamic string allocations.
     * @param _epochRoot The unique root identifier hash representing the collectively authorized consortium epoch state.
     * @param _diplomaHashes Array containing unique 32-byte primary document identifiers generated off-chain.
     * @param _citizenHashes Array containing unique pre-computed identity attribute hashes (keccak256(Name || NationalID || SecretSalt)).
     */
    function emitEpochState(
        bytes32 _epochRoot,
        bytes32[] calldata _diplomaHashes,
        bytes32[] calldata _citizenHashes
    ) external onlyActiveRole(Role.Inspector) {
        if (_epochRoot == bytes32(0)) revert ZeroHashDetected();
        if (validatedEpochs[_epochRoot]) revert DuplicateEpochDetected();
        if (_diplomaHashes.length != _citizenHashes.length) revert ArrayLengthMismatch();

        validatedEpochs[_epochRoot] = true;
        epochHistory.push(_epochRoot);

        uint256 len = _diplomaHashes.length;
        for (uint256 i = 0; i < len; i++) {
            bytes32 dHash = _diplomaHashes[i];
            bytes32 cHash = _citizenHashes[i];
            
            if (dHash == bytes32(0) || cHash == bytes32(0)) revert ZeroHashDetected();
            
            // Defends against data overwrite exploits; forces transactional revert if collision occurs
            if (cryptoAnchors[dHash][cHash] != bytes32(0)) {
                revert RecordAlreadyExists();
            }

            // Seal the mathematical anchor. No plain-text meta-parameters touch the state storage.
            cryptoAnchors[dHash][cHash] = _epochRoot;
        }

        // Emits audit trail anchor capturing the specific calling inspector's identity vector
        emit EpochValidated(_epochRoot, msg.sender, block.timestamp);
    }

    /**
     * @notice Explicitly revokes a specific cryptographic anchor in the event of administrative corrections.
     * @param _diplomaHash The unique 32-byte primary document identifier hash.
     * @param _citizenHash The unique pre-computed identity attribute hash.
     */
    function revokeAnchor(bytes32 _diplomaHash, bytes32 _citizenHash) external onlyActiveRole(Role.Admin) {
        if (cryptoAnchors[_diplomaHash][_citizenHash] == bytes32(0)) revert RecordNotFoundOrAccessDenied();
        
        cryptoAnchors[_diplomaHash][_citizenHash] = bytes32(0);
        emit AnchorRevoked(_diplomaHash, _citizenHash, block.timestamp);
    }

    // --- READ VIEW LAYER: STATIC O(1) NO-OVERHEAD VERIFICATION ENGINE ---

    /**
     * @notice High-performance, loop-free validation engine executing with absolute O(1) computational complexity.
     * @dev Bypasses execution runtime degradation, delivering a flat gas ceiling across millions of active records.
     * @dev If an off-chain data subject requests erasure (GDPR Art. 17), the university executes 'crypto-shredding' 
     *      by purging the local 'SecretSalt'. This renders the regeneration of '_calculatedCitizenHash' mathematically 
     *      impossible, effectively isolating the on-chain anchor without requiring mutable storage purges.
     * @param _diplomaHash Persistent unique 32-byte cryptographic document identifier hash scanned via client runtime.
     * @param _calculatedCitizenHash Pre-computed client-side attribute token verifying matching data subject integrity.
     * @return bytes32 if the record matches an authentic, unaltered, and unrevoked academic credential anchor.
     */
    function verifyDiploma(
    bytes32 _diplomaHash, 
    bytes32 _calculatedCitizenHash
    ) external view returns (bool) {
        if (deactivatedStudents[_calculatedCitizenHash]) {
            return false;
        }
        
        bytes32 associatedEpoch = cryptoAnchors[_diplomaHash][_calculatedCitizenHash];
        if (associatedEpoch == bytes32(0)) {
            return false;
        }
        
        return validatedEpochs[associatedEpoch];
    }


    /**
     * @notice Invalidates an entire consensus batch epoch by revoking its cryptographic Merkle root.
     * @dev Operates with strict O(1) computational complexity by flipping the authorization flag.
     *      Any dynamic verification checking this epoch root will instantly fail.
     * @param _epochRoot The unique 32-byte Merkle root identifier of the target batch to be revoked.
     */
    function revokeEpoch(bytes32 _epochRoot) external onlyActiveRole(Role.Inspector) {
        // Enforce boundary check ensuring the target epoch root actually exists within the authenticated state
        if (!validatedEpochs[_epochRoot]) {
            revert RecordNotFoundOrAccessDenied();
        }
        
        // Execute state mutation by flipping the validation flag to false
        // This single line effectively anchors a mass-revocation event for all nested credentials under this root
        validatedEpochs[_epochRoot] = false;
        
        // Emit an event to ensure the revocation is indexed and traceable by off-chain synchronization workers
        emit EpochRevoked(_epochRoot, msg.sender, block.timestamp);
    }

    /**
     * @notice GDPR deletion status
     * @param _citizenHash The hash of the graduate (name || PID || secretSalt)
     * @param _isDeactivated Deletion flag (True = deleted)
    */
    function setStudentDeactivatedStatus(bytes32 _citizenHash, bool _isDeactivated) external onlyActiveRole(Role.Admin) {
        deactivatedStudents[_citizenHash] = _isDeactivated;
        emit StudentDeactivatedStatusChanged(_citizenHash, _isDeactivated);
    }

}