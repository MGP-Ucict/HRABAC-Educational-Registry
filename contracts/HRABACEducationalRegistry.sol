// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HRABAC Educational Registry Smart Contract
 * @notice Demonstrates deterministic hybrid access control with strict Separation of Duties.
 * @dev Optimized specifically for Layer 2 execution (Arbitrum) via tight storage slot packing.
 *      Distinguishes between technical Admin privileges and academic Inspector privileges.
 */
contract HRABACEducationalRegistry {

    // 1. Unified enum layout separating the technical Admin and the business Inspector
    enum Role { None, Admin, Inspector, Graduate, Employer }

    error UnauthorizedAccess();

    // 2. Storage Slot Packing (Optimized for L2): role (1 byte) + isActive (1 byte) 
    // are packed into a single 32-byte slot together with the uint256 ID, minimizing SSTORE gas costs.
    struct UserProfile {
        uint256 id;        // National ID, Company ID, or Institutional/System Code
        Role role;         // Unified system role classification (1 byte)
        bool isActive;     // Activation switch for soft-deactivation (1 byte)
    }

    // 3. Single on-chain user mapping replacing separate state tables
    mapping(address => UserProfile) public users;

    // 4. Pure O(1) deterministic diploma ledger (No dynamic arrays stored on-chain)
    // Map: Diploma Hash => Cryptographic Student Address
    mapping(bytes32 => address) private diplomaToOwner;

    // 5. Blockchain Events for off-chain indexing (Enables high-performance frontend tracking)
    event RoleStatusChanged(uint256 indexed id, string roleType, bool isActive, uint256 timestamp);
    event UserRegistered(address indexed userAddress, uint256 indexed id, Role role);
    event DiplomaAdded(address indexed studentAddress, bytes32 indexed diplomaHash, uint256 timestamp);

    // Unified modifier enforcing both explicit Role classification and Active status
    modifier onlyActiveRole(Role _requiredRole) {
        if (users[msg.sender].role != _requiredRole || !users[msg.sender].isActive) revert UnauthorizedAccess();
        _;
    }

    constructor(address _initialInspector) {
        require(_initialInspector != address(0), "Invalid inspector address");

        // The deployer (the developer/programmer) is onboarded as the technical Admin
        users[msg.sender] = UserProfile({
            id: 101, // Tech Admin system ID
            role: Role.Admin,
            isActive: true
        });
        emit UserRegistered(msg.sender, 101, Role.Admin);

        // The designated institutional entity is onboarded as the business Inspector
        users[_initialInspector] = UserProfile({
            id: 202, // Government Inspector institutional ID
            role: Role.Inspector,
            isActive: true
        });
        emit UserRegistered(_initialInspector, 202, Role.Inspector);
    }

    // --- Technical Administrative Core (Executed ONLY by the active Admin / Programmer) ---

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
     * @notice Flexible soft-deactivation switch for any registered system profile
     * @dev Mutates only a single byte within the packed slot, resulting in minimal gas overhead.
     *      The Admin can suspend any user (including an Inspector), but cannot manipulate diploma data.
     */
    function setUserActiveStatus(address _userAddress, bool _status) external onlyActiveRole(Role.Admin) {
        require(users[_userAddress].role != Role.None, "User profile does not exist");
        require(_userAddress != msg.sender, "Admin cannot deactivate themselves");
        
        users[_userAddress].isActive = _status;
        
        string memory roleLabel;
        if (users[_userAddress].role == Role.Graduate) roleLabel = "Graduate";
        else if (users[_userAddress].role == Role.Employer) roleLabel = "Employer";
        else if (users[_userAddress].role == Role.Inspector) roleLabel = "Inspector";
        else roleLabel = "Admin";

        emit RoleStatusChanged(users[_userAddress].id, roleLabel, _status, block.timestamp);
    }

    // --- Business / Academic Core (Executed ONLY by an active Government Inspector) ---

    /**
     * @notice Registers a Graduate student entity
     * @param _student Cryptographic public address of the student
     * @param _studentID Unique anonymized academic identification number
     */
    function registerGraduate(address _student, uint256 _studentID) external onlyActiveRole(Role.Inspector) {
        require(_student != address(0), "Invalid student address");
        users[_student] = UserProfile({
            id: _studentID,
            role: Role.Graduate,
            isActive: true
        });
        emit UserRegistered(_student, _studentID, Role.Graduate);
    }

    /**
     * @notice Registers an authorized corporate Employer entity
     * @param _employer Cryptographic public address of the company
     * @param _companyID Unique official company registration index
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
     * @notice Registers a new diploma record linked to an anonymized document hash
     * @dev Absolute O(1) transaction overhead. Eliminates gas-heavy on-chain arrays.
     * @param _student Cryptographic address of the legitimate graduate owner
     * @param _diplomaHash Off-chain generated cryptographic SHA-256 hash of the PDF diploma document
     */
    function addDiploma(address _student, bytes32 _diplomaHash) external onlyActiveRole(Role.Inspector) {
        require(_student != address(0), "Invalid student address");
        //require(users[_student].role == Role.Graduate, "Target address is not a registered Graduate");
        require(diplomaToOwner[_diplomaHash] == address(0), "Diploma hash already registered in state");

        // Fixed-size key-value mapping storage operation
        diplomaToOwner[_diplomaHash] = _student;

        emit DiplomaAdded(_student, _diplomaHash, block.timestamp);
    }

    // --- Business Evaluation Core: HRABAC Execution Gates ---

    /**
     * @notice Context-aware validation mechanism providing fine-grained verification
     * @dev HRABAC verification: checks Employer role status (RBAC) + dynamic ownership match (ABAC attribute)
     * @param _studentAddress Public cryptographic address submitted by the job applicant
     * @param _calculatedHash Locally computed SHA-256 hash of the physical diploma document
     * @return bool True if authentic and explicitly owned by the specified applicant, false otherwise
     */
    function verifyDiploma(address _studentAddress, bytes32 _calculatedHash) 
        external 
        onlyActiveRole(Role.Employer) 
        returns (bool) 
    {
        // One-step deterministic data-relationship verification check
        if (diplomaToOwner[_calculatedHash] == _studentAddress && _studentAddress != address(0)) {
            return true;
        }
        return false;
    }

    /**
     * @notice Public view function to pull general profile metrics
     * @param _user Target wallet address to audit
     */
    function getUserProfile(address _user) external view returns (uint256 id, Role role, bool isActive) {
        UserProfile memory profile = users[_user];
        return (profile.id, profile.role, profile.isActive);
    }
}
