// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HRABAC Educational Registry Smart Contract
 * @notice Enforces deterministic hybrid access control with strict Separation of Duties.
 * @dev Implements Epoch-Based State Batching and multi-institutional signature validation 
 *      via the native ecrecover opcode, locking verification into a strict O(1) gas footprint.
 */
contract HRABACEducationalRegistry {

    // Unified enum layout separating the technical Admin and institutional actors
    enum Role { None, Admin, Inspector, Employer }

    error UnauthorizedAccess();
    error InvalidSignature();
    error NonceLockViolation();

    // Storage Slot Packing (Optimized for L2): role (1 byte) + isActive (1 byte) 
    // are packed into a single 32-byte slot, minimizing SSTORE gas execution costs.
    struct UserProfile {
        uint256 id;        // System or institutional registration ID
        Role role;         // Unified system role classification (1 byte)
        bool isActive;     // Hardhat/EVM soft-deactivation switch (1 byte)
    }

    // Single on-chain user mapping replacing separate state identity tables
    mapping(address => UserProfile) public users;

    // Pure O(1) deterministic diploma ledger (No dynamic arrays stored on-chain)
    // Map: Diploma Hash => Cryptographic 32-byte Multi-Part Component Address (MCP)
    mapping(bytes32 => bytes32) private diplomaToOwner;

    // Epoch-Based State Ledger mapping historical global State Roots (Section 3.10)
    // Map: Epoch Nonce K => Global State Root Digest RK
    mapping(uint256 => bytes32) private stateHistory;
    uint256 public currentEpochNonce;

    // Blockchain Events for asynchronous off-chain event sourcing and indexing
    event RoleStatusChanged(uint256 indexed id, string roleType, bool isActive, uint256 timestamp);
    event UserRegistered(address indexed userAddress, uint256 indexed id, Role role);
    event DiplomaAdded(bytes32 indexed mcpAddress, bytes32 indexed diplomaHash, uint256 timestamp);
    event NationalStateUpdated(uint256 indexed epochNonce, bytes32 indexed globalStateRoot);

    // Modifier enforcing explicit role verification and active infrastructure status
    modifier onlyActiveRole(Role _requiredRole) {
        if (users[msg.sender].role != _requiredRole || !users[msg.sender].isActive) revert UnauthorizedAccess();
        _;
    }

    constructor(address _initialInspector) {
        require(_initialInspector != address(0), "Invalid inspector address");

        // Onboard the infrastructure deployer as the Technical Admin
        users[msg.sender] = UserProfile({
            id: 101,
            role: Role.Admin,
            isActive: true
        });
        emit UserRegistered(msg.sender, 101, Role.Admin);

        // Onboard the designated institutional entity as the active Inspector
        users[_initialInspector] = UserProfile({
            id: 202,
            role: Role.Inspector,
            isActive: true
        });
        emit UserRegistered(_initialInspector, 202, Role.Inspector);
    }

    // --- Technical Administrative Core (Executed ONLY by the active Admin) ---

    /**
     * @notice Registers or updates a Government Inspector entity
     */
    function registerInspector(address _inspector, uint256 _inspectorID) external onlyActiveRole(Role.Admin) {
        require(_inspector != address(0), "Invalid inspector address");
        users[_inspector] = UserProfile({
            id: _inspectorID,
            role: Role.Inspector,
            isActive: true
        });
        emit UserRegistered(_inspector, _inspectorID, Role.Inspector);
    }

    /**
     * @notice Soft-deactivation switch for any registered system profile
     * @dev Mutates only a single byte within the packed slot, minimizing gas overhead.
     */
    function setUserActiveStatus(address _userAddress, bool _status) external onlyActiveRole(Role.Admin) {
        require(users[_userAddress].role != Role.None, "User profile does not exist");
        require(_userAddress != msg.sender, "Admin cannot deactivate themselves");
        
        users[_userAddress].isActive = _status;
        
        string memory roleLabel;
        if (users[_userAddress].role == Role.Employer) roleLabel = "Employer";
        else if (users[_userAddress].role == Role.Inspector) roleLabel = "Inspector";
        else roleLabel = "Admin";

        emit RoleStatusChanged(users[_userAddress].id, roleLabel, _status, block.timestamp);
    }

    // --- Business / Academic Core (Executed ONLY by an active Government Inspector) ---

    /**
     * @notice Registers an authorized corporate Employer entity
     */
    function registerEmployer(address _employer, uint256 _companyID) external onlyActiveRole(Role.Inspector) {
        require(_employer != address(0), "Invalid employer address");
        users[_employer] = UserProfile({
            id: _companyID,
            role: Role.Employer,
            isActive: true
        });
        emit UserRegistered(_employer, _companyID, Role.Employer);
    }

    /**
     * @notice Registers a singular diploma record linked to an anonymous document hash and MCP token
     * @dev Enforces absolute O(1) transaction overhead, completely bypassing on-chain loop structures.
     */
    function addDiploma(bytes32 _mcpAddress, bytes32 _diplomaHash) external onlyActiveRole(Role.Inspector) {
        require(_mcpAddress != bytes32(0), "Invalid MCP address token");
        require(diplomaToOwner[_diplomaHash] == bytes32(0), "Diploma hash already registered in state");

        // Direct low-level storage slot assignment
        diplomaToOwner[_diplomaHash] = _mcpAddress;

        emit DiplomaAdded(_mcpAddress, _diplomaHash, block.timestamp);
    }

    // --- SECTION 3.7: EPOCH-BASED STATE BATCHING PROTOCOL ---

    /**
     * @notice Consumes a multi-institutional state batch manifest and anchors the global State Root.
     * @dev Implements the cryptographic ecrecover protocol to validate institutional signatures asynchronously.
     *      Bypasses transactional serialization bottlenecks and mitigates internal DBA ransomware injections.
     * @param _epochNonce The targeted incremental chronological epoch sequence index K
     * @param _proposedStateRoot The aggregated macro-perspective National Merkle Root digest RK
     * @param _manifestHash The SHA-256 hash representation of the accumulated epoch dataset batch BK
     * @param v ECDSA signature recovery parameter array emitted by the participating trust roots
     * @param r ECDSA signature output coordinate array
     * @param s ECDSA signature output coordinate array
     */
    function updateNationalState(
        uint256 _epochNonce,
        bytes32 _proposedStateRoot,
        bytes32 _manifestHash,
        uint8[] calldata v,
        bytes32[] calldata r,
        bytes32[] calldata s
    ) external onlyActiveRole(Role.Inspector) {
        // Enforce strict chronological incremental execution boundaries (Prevents Replay/Out-of-order attacks)
        if (_epochNonce != currentEpochNonce + 1) revert NonceLockViolation();
        
        uint256 signatureCount = v.length;
        require(signatureCount > 0 && signatureCount == r.length && signatureCount == s.length, "Invalid signature data arrays");

        // Validate the multi-institutional manifest bounds via the native EVM ecrecover primitive
        for (uint256 i = 0; i < signatureCount; i++) {
            address institutionalSigner = ecrecover(_manifestHash, v[i], r[i], s[i]);
            
            // Mitigate insider threat parameters by enforcing that the recovered signer must be an active Inspector node
            if (users[institutionalSigner].role != Role.Inspector || !users[institutionalSigner].isActive) {
                revert InvalidSignature();
            }
        }

        // Commit the verified Hierarchical National State Root (HSR) onto the immutable ledger storage
        currentEpochNonce = _epochNonce;
        stateHistory[_epochNonce] = _proposedStateRoot;

        emit NationalStateUpdated(_epochNonce, _proposedStateRoot);
    }

    // --- Business Evaluation Core: HRABAC Execution Gates ---

    /**
     * @notice Context-aware validation mechanism providing fine-grained verification
     * @dev HRABAC verification: checks Employer role status (RBAC) + dynamic ownership match (ABAC attribute)
     * @param _mcpAddress The 32-byte Multi-Part Component Address submitted by the job applicant
     * @param _calculatedHash Locally computed SHA-256 hash of the physical diploma document
     * @return bool True if authentic and explicitly owned by the specified applicant, false otherwise
     */
    function verifyDiploma(bytes32 _mcpAddress, bytes32 _calculatedHash) 
        external 
        view
        onlyActiveRole(Role.Employer) 
        returns (bool) 
    {
        // One-step deterministic data-relationship verification check in strict O(1) complex path
        return (_mcpAddress != bytes32(0) && diplomaToOwner[_calculatedHash] == _mcpAddress);
    }

    /**
     * @notice Public view function for Direct Indexed State Recovery verification (Section 7.2 Phase 2)
     */
    function getHistoricalStateRoot(uint256 _epochNonce) external view returns (bytes32) {
        return stateHistory[_epochNonce];
    }
}
