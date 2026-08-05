// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HRABAC Educational Registry Smart Contract (Author's Core with Multi-Sig & Student History)
 * @notice Combines the author's original structure with true m-of-n multi-sig and student credential indexing.
 * @dev Replaces heavy evaluation branches with zero-overhead inline Yul assembly for O(1) efficiency.
 */
contract HRABACEducationalRegistry {

    enum Role { None, Admin, Inspector, Employer, ConsensusNode }

    // Custom errors replacing expensive revert string literals
    error UnauthorizedAccess();
    error InvalidSignature();
    error NonceLockViolation();
    error InvalidSignatureLength();
    error ZeroAddressDetected();
    error UserDoesNotExist();
    error AdminCannotSelfDeactivate();
    error InvalidMPCToken();
    error DiplomaAlreadyRegistered();
    error InvalidAdministrativeAssignment();
    error DuplicateSignatureDetected();
    error InsufficientValidSignatures();
    error InvalidConsensusConfiguration();

    struct UserProfile {
        uint256 id;        
        Role role;         
        bool isActive;     
    }

    // --- ORIGINAL STORAGE LAYOUT OF THE AUTHOR ---
    // Slot 0: Maps operator addresses to their structural roles and states
    mapping(address => UserProfile) public users;
    
    // Slot 1: Maps a specific diploma asset hash to a student's dynamic identity token (mpcAddress)
    mapping(bytes32 => bytes32) private diplomaToOwner;
    
    // Slot 2: Tracks the state root emission index history for Point-In-Time recovery
    mapping(uint256 => bytes32) private stateHistory;

    // --- NEW EXTENDED STORAGE SLOTS ---
    // Slot 3: Maps authorized multi-sig consortium nodes
    mapping(address => bool) public isConsensusNode;
    
    // Slot 4: Allows a role-free student profile to instantly extract an array of all their diploma hashes
    mapping(bytes32 => bytes32[]) private studentToDiplomas;

    uint256 public currentEpochNonce;
    uint256 public immutable requiredSignatures;

    event RoleStatusChanged(uint256 indexed id, string roleType, bool isActive, uint256 timestamp);
    event UserRegistered(address indexed userAddress, uint256 indexed id, Role role);
    event DiplomaAdded(bytes32 indexed mpcAddress, bytes32 indexed diplomaHash, uint256 timestamp);
    event NationalStateUpdated(uint256 indexed epochNonce, bytes32 indexed globalStateRoot);
    event ConsensusNodeStatusChanged(address indexed node, bool status);

    // Hyper-optimized access gate using inline assembly to bypass high-level mapping checks
    modifier onlyActiveRole(Role _requiredRole) {
        assembly {
            // Compute the storage slot for users[msg.sender]
            // users mapping is located at Slot index 0
            mstore(0x00, caller())
            mstore(0x20, 0) 
            let slot := keccak256(0x00, 0x40)
            
            // UserProfile layout packing: slot 0 = id, slot 1 (slot + 1) = packed (role, isActive)
            let packedValue := sload(add(slot, 1))
            
            // Extract role (first byte) and isActive (second byte) using bit shifts
            let userRole := byte(31, packedValue)
            let isActive := byte(30, packedValue)
            
            // Validate: userRole == _requiredRole AND isActive == 1 (true)
            if iszero(and(eq(userRole, _requiredRole), eq(isActive, 1))) {
                // Store selector for UnauthorizedAccess() -> 0x3c4308a8
                mstore(0x00, 0x3c4308a8)
                revert(0x1c, 0x04)
            }
        }
        _;
    }

    /**
     * @notice Initializes the contract registry embedding the multi-sig validator nodes configurations.
     */
    constructor(address _admin, address[] memory _nodes, uint256 _requiredSignatures) {
        if (_admin == address(0)) revert ZeroAddressDetected();
        if (_requiredSignatures == 0 || _requiredSignatures > _nodes.length) {
            revert InvalidConsensusConfiguration();
        }
        
        users[_admin] = UserProfile({
            id: 101,
            role: Role.Admin,
            isActive: true
        });
        emit UserRegistered(_admin, 101, Role.Admin);

        // Provision the multi-institutional consortium nodes
        for (uint256 i = 0; i < _nodes.length; i++) {
            if (_nodes[i] == address(0)) revert InvalidConsensusConfiguration();
            isConsensusNode[_nodes[i]] = true;
            emit ConsensusNodeStatusChanged(_nodes[i], true);
        }
        requiredSignatures = _requiredSignatures;
    }

    // --- Technical Administrative Core ---

    function registerSystemNode(address _node, uint256 _nodeID, Role _role) external onlyActiveRole(Role.Admin) {
        if (_node == address(0)) revert ZeroAddressDetected();
        if (_role != Role.Inspector && _role != Role.ConsensusNode) revert InvalidAdministrativeAssignment();
        
        users[_node] = UserProfile({
            id: _nodeID,
            role: _role,
            isActive: true
        });

        if (_role == Role.ConsensusNode) {
            isConsensusNode[_node] = true;
        }
        emit UserRegistered(_node, _nodeID, _role);
    }

    function registerInspector(address _inspector, uint256 _inspectorID) external onlyActiveRole(Role.Admin) {
        if (_inspector == address(0)) revert ZeroAddressDetected();
        
        users[_inspector] = UserProfile({
            id: _inspectorID,
            role: Role.Inspector,
            isActive: true
        });
        
        emit UserRegistered(_inspector, _inspectorID, Role.Inspector);
    }

    function setUserActiveStatus(address _userAddress, bool _status) external onlyActiveRole(Role.Admin) {
        if (users[_userAddress].role == Role.None) revert UserDoesNotExist();
        if (_userAddress == msg.sender) revert AdminCannotSelfDeactivate();
        
        users[_userAddress].isActive = _status;
        
        string memory roleLabel;
        Role r = users[_userAddress].role;
        if (r == Role.Employer) roleLabel = "Employer";
        else if (r == Role.Inspector) roleLabel = "Inspector";
        else if (r == Role.ConsensusNode) roleLabel = "ConsensusNode";
        else roleLabel = "Admin";

        emit RoleStatusChanged(users[_userAddress].id, roleLabel, _status, block.timestamp);
    }

    // --- Business / Academic Core ---

    function registerEmployer(address _employer, uint256 _companyID) external onlyActiveRole(Role.Inspector) {
        if (_employer == address(0)) revert ZeroAddressDetected();
        users[_employer] = UserProfile({
            id: _companyID,
            role: Role.Employer,
            isActive: true
        });
        emit UserRegistered(_employer, _companyID, Role.Employer);
    }

    /**
     * @notice Maps the resource diploma hash to the student profile token.
     * @dev Automatically updates the secondary extraction matrix to track student asset arrays.
     */
    function addDiploma(bytes32 _mpcAddress, bytes32 _diplomaHash) external onlyActiveRole(Role.Inspector) {
        if (_mpcAddress == bytes32(0)) revert InvalidMPCToken();
        if (diplomaToOwner[_diplomaHash] != bytes32(0)) revert DiplomaAlreadyRegistered();

        // Enforce the core historical link mapping the student profile boundary inside Slot 1
        diplomaToOwner[_diplomaHash] = _mpcAddress;

        // Populate the student profile credential repository inside Slot 4
        studentToDiplomas[_mpcAddress].push(_diplomaHash);

        emit DiplomaAdded(_mpcAddress, _diplomaHash, block.timestamp);
    }

    // --- SECTION 3.7: AUTHOR'S STATE BATCHING EXTENDED WITH TRUE M-OF-N MULTI-SIG ---

    /**
     * @notice Updates national states via decentralized threshold multisig verification matrix parameters.
     */
    function updateNationalState(
        uint256 _epochNonce,
        bytes32 _proposedStateRoot,
        bytes32 _manifestHash,
        bytes[] calldata _signatures
    ) external onlyActiveRole(Role.Inspector) {
       
        if (_epochNonce != currentEpochNonce + 1) revert NonceLockViolation();
        if (_signatures.length < requiredSignatures) revert InsufficientValidSignatures();

        address lastSigner = address(0);
        uint256 validSignaturesCount = 0;

        // Process the array of signatures emitted by the multi-institutional consortium nodes
        for (uint256 i = 0; i < _signatures.length; i++) {
            address signer = _recoverSigner(_manifestHash, _signatures[i]);
            
            // Strict sorting requirement to eliminate duplication reuse injection exploits
            if (signer <= lastSigner) revert DuplicateSignatureDetected();
            lastSigner = signer;

            if (isConsensusNode[signer]) {
                validSignaturesCount++;
            }

            if (validSignaturesCount == requiredSignatures) {
                break;
            }
        }

        if (validSignaturesCount < requiredSignatures) revert InsufficientValidSignatures();

        currentEpochNonce = _epochNonce;
        stateHistory[_epochNonce] = _proposedStateRoot;

        emit NationalStateUpdated(_epochNonce, _proposedStateRoot);
    }

    function _recoverSigner(bytes32 _hash, bytes calldata _sig) internal pure returns (address) {
        if (_sig.length != 65) revert InvalidSignatureLength();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(_sig.offset)
            s := calldataload(add(_sig.offset, 0x20))
            v := byte(0, calldataload(add(_sig.offset, 0x40)))
        }
        return ecrecover(_hash, v, r, s);
    }

    // --- Business Evaluation Core: HRABAC Execution Gates ---

    /**
     * @dev Protected via the static Role.Employer modifier. Fixed the compilation bug by placing internal Yul methods correctly.
     */
    function verifyDiplomaHRABAC(
        bytes32 _mpcAddress,
        bytes32 _calculatedHash
    ) external view onlyActiveRole(Role.Employer) returns (bool) {
        assembly {
            // Internal Yul function declaration placed correctly at the top of the block scope
            function mjs_is_identical(a, b) -> res {
                res := eq(a, b)
            }

            // Compute storage slot location for diplomaToOwner[_calculatedHash]
            // diplomaToOwner is mapped directly at Slot index 1
            mstore(0x00, _calculatedHash)
            mstore(0x20, 1)
            let slot := keccak256(0x00, 0x40)
            
            let registeredMPC := sload(slot)
            
            // Boolean extraction validation path
            let accessGranted := and(
                iszero(iszero(registeredMPC)),
                mjs_is_identical(registeredMPC, _mpcAddress)
            )
            
            mstore(0x00, accessGranted)
            return(0x00, 0x20)
        }
    }

    /**
     * @notice Allows a role-free student profile to extract the complete list of their registered diploma hashes.
     * @dev This view function enables the student frontend to query all their personal digital assets.
     * @param _mpcAddress The identity attribute token of the student profile (generated off-chain via MPC).
     * @return bytes32[] Array containing all historical cryptographic asset hashes matching the student profile.
     */
    function getStudentDiplomas(bytes32 _mpcAddress) external view returns (bytes32[] memory) {
        if (_mpcAddress == bytes32(0)) revert InvalidMPCToken();
        return studentToDiplomas[_mpcAddress];
    }

    function getStateRoot(uint256 _epochNonce) external view returns (bytes32) {
        return stateHistory[_epochNonce];
    }
}
