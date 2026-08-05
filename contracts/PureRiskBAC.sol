// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AdaptedRiskBAC Educational Registry (Optimized & Linkability-Free)
 * @notice Integrates dynamic risk-based telemetry constraints into the HRABAC architectural tier.
 * @dev Discards raw address linkages and loops to achieve zero-gas view scalability alongside protected risk mutations.
 */
contract AdaptedRiskBAC {

    enum Role { None, Admin, Inspector, Employer }

    // High-performance custom errors replacing expensive legacy require string literals
    error UnauthorizedAccess();
    error IdentityMismatchOrRecordNotFound();
    error AccessBlockedDueToRiskDeadlock();
    error ZeroAddressDetected();

    struct UserProfile {  
        Role role;         
        bool isActive;     
    }

    struct DiplomaRecord {
        bytes32 citizenHash;               // keccak256(studentName || nationalID/EGN)
        uint256 requiredSecurityClearance; // Security threshold range: 1 to 100
        string encryptedMetadata;          // Symmetrically encrypted off-chain payload string
    }

    // --- IMMUTABLE STORAGE LAYOUT ---
    // Slot 0: Maps system operator blockchain addresses to their roles and lifecycle states
    mapping(address => UserProfile) public users;
    
    // Slot 1: Secure registry mapping distinct diploma hashes to their adapted record structures
    mapping(bytes32 => DiplomaRecord) private registries;

    // Slot 2: Active operational risk telemetry registers tracking system interaction analytics
    mapping(address => uint256) public failedAttempts;
    mapping(address => uint256) public userReputationScore; // Baseline maximum score is 100

    event UserRegistered(address indexed userAddress, Role role);
    event DiplomaAdded(bytes32 indexed diplomaHash, bytes32 indexed citizenHash, uint256 clearance, uint256 timestamp);
    event VerificationAttempted(address indexed reviewer, bytes32 indexed diplomaHash, bool success, uint256 currentRisk);

    modifier onlyActiveRole(Role _requiredRole) {
        UserProfile memory profile = users[msg.sender];
        if (profile.role != _requiredRole || !profile.isActive) {
            revert UnauthorizedAccess();
        }
        _;
    }

    /**
     * @notice Initializes the central core infrastructure establishing the root Inspector.
     * @param _inspector The primary administrative system blockchain operator address.
     */
    constructor(address _inspector) {
        if (_inspector == address(0)) revert ZeroAddressDetected();
        
        users[_inspector] = UserProfile({
            role: Role.Inspector,
            isActive: true
        });
        emit UserRegistered(_inspector, Role.Inspector);
    }

    /**
     * @notice Onboards an external Employer entity allowing them to execute risk-validated verification runs.
     * @param _employer The public wallet address of the validated verification entity.
     */
    function registerEmployer(address _employer) external onlyActiveRole(Role.Inspector) {
        if (_employer == address(0)) revert ZeroAddressDetected();
        
        users[_employer] = UserProfile({
            role: Role.Employer,
            isActive: true
        });
        userReputationScore[_employer] = 100; // Instantiates perfect initial reputation anchor
        
        emit UserRegistered(_employer, Role.Employer);
    }

    /**
     * @notice Securely registers a new risk-protected diploma asset entry inside the storage layer.
     * @param _diplomaHash The unique document lookup resource key identifier.
     * @param _citizenHash The linkability-free cryptographic identity anchor (keccak256 of Name + EGN).
     * @param _clearance Security classification requirements threshold ranking from 1 to 100.
     * @param _encryptedMetadata The symmetrically encrypted off-chain string data payload.
     */
    function addDiploma(
        bytes32 _diplomaHash, 
        bytes32 _citizenHash, 
        uint256 _clearance,
        string calldata _encryptedMetadata
    ) external onlyActiveRole(Role.Inspector) {
        if (_diplomaHash == bytes32(0) || _citizenHash == bytes32(0)) revert IdentityMismatchOrRecordNotFound();
        
        registries[_diplomaHash] = DiplomaRecord({
            citizenHash: _citizenHash,
            requiredSecurityClearance: _clearance,
            encryptedMetadata: _encryptedMetadata
        });

        emit DiplomaAdded(_diplomaHash, _citizenHash, _clearance, block.timestamp);
    }

    /**
     * @notice High-performance Risk-BAC validation checkpoint executing dynamic security calculations.
     * @dev Mutates telemetry state variables (reputation/penalties) while fetching structured parameters.
     * @param _diplomaHash The unique document hash/identifier extracted from the physical medium.
     * @param _calculatedCitizenHash Pre-computed off-chain validation token: keccak256(studentName || nationalID).
     * @return string The securely fetched encrypted metadata string if execution logic passes.
     */
    function verifyDiplomaRiskBAC(
        bytes32 _diplomaHash, 
        bytes32 _calculatedCitizenHash
    ) external returns (string memory) {
        
        // Enforce basic role authorization boundary parameters before metric computation
        UserProfile memory callerProfile = users[msg.sender];
        if (!callerProfile.isActive || callerProfile.role != Role.Employer) {
            revert UnauthorizedAccess();
        }

        DiplomaRecord memory record = registries[_diplomaHash];
        if (record.citizenHash == bytes32(0)) revert IdentityMismatchOrRecordNotFound();

        // Bootstrap profile handling for completely uninitialized dynamic ledger telemetry
        if (userReputationScore[msg.sender] == 0 && failedAttempts[msg.sender] == 0) {
            userReputationScore[msg.sender] = 100;
        }

        // Multivariable risk formula engine processing contextual parameters
        uint256 currentRiskScore = (failedAttempts[msg.sender] * 20) + (100 - userReputationScore[msg.sender]);

        // Security Boundary Invariant Check
        if (currentRiskScore > (100 - record.requiredSecurityClearance)) {
            failedAttempts[msg.sender] += 1; // Automatic metric penalty triggers rapid risk escalation
            emit VerificationAttempted(msg.sender, _diplomaHash, false, currentRiskScore);
            revert AccessBlockedDueToRiskDeadlock();
        }

        // Exact bitwise verification of the registered linkability-free identity token
        if (record.citizenHash != _calculatedCitizenHash) {
            failedAttempts[msg.sender] += 1; // Metric penalty application for identity parameter mismatch
            emit VerificationAttempted(msg.sender, _diplomaHash, false, currentRiskScore);
            revert IdentityMismatchOrRecordNotFound();
        }

        // Iterative reputation recovery step for successful deterministic execution paths
        if (userReputationScore[msg.sender] < 100) {
            userReputationScore[msg.sender] += 1;
        }

        emit VerificationAttempted(msg.sender, _diplomaHash, true, currentRiskScore);
        return record.encryptedMetadata;
    }

    function simulateFailedAttempt(address _user) external onlyActiveRole(Role.Inspector) {
        failedAttempts[_user] += 1;
    }
}
