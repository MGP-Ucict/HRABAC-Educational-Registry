// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HRABAC Educational Registry Smart Contract (Hyper-Optimized Version)
 * @notice Enforces deterministic hybrid access control with ultra-low gas footprints.
 * @dev Replaces heavy high-level evaluation branches with zero-overhead inline Yul assembly.
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
    error InvalidMCPToken();
    error DiplomaAlreadyRegistered();
    error InvalidAdministrativeAssignment();

    struct UserProfile {
        uint256 id;        
        Role role;         
        bool isActive;     
    }

    mapping(address => UserProfile) public users;
    mapping(bytes32 => bytes32) private diplomaToOwner;
    mapping(uint256 => bytes32) private stateHistory;

    uint256 public currentEpochNonce;

    event RoleStatusChanged(uint256 indexed id, string roleType, bool isActive, uint256 timestamp);
    event UserRegistered(address indexed userAddress, uint256 indexed id, Role role);
    event DiplomaAdded(bytes32 indexed mcpAddress, bytes32 indexed diplomaHash, uint256 timestamp);
    event NationalStateUpdated(uint256 indexed epochNonce, bytes32 indexed globalStateRoot);

    // Hyper-optimized access gate using inline assembly to bypass high-level mapping checks
    modifier onlyActiveRole(Role _requiredRole) {
        assembly {
            // Compute the storage slot for users[msg.sender]
            // mapping slot is keccak256(key, mapping_slot). 'users' is at slot 0.
            mstore(0x00, caller())
            mstore(0x20, 0) // 'users' mapping is at slot index 0
            let slot := keccak256(0x00, 0x40)
            
            // UserProfile structure: slot 0 = id, slot 1 (slot + 1) = packed (role, isActive)
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

    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddressDetected();
        
        users[_admin] = UserProfile({
            id: 101,
            role: Role.Admin,
            isActive: true
        });
        emit UserRegistered(_admin, 101, Role.Admin);
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

    function addDiploma(bytes32 _mcpAddress, bytes32 _diplomaHash) external onlyActiveRole(Role.Inspector) {
        if (_mcpAddress == bytes32(0)) revert InvalidMCPToken();
        if (diplomaToOwner[_diplomaHash] != bytes32(0)) revert DiplomaAlreadyRegistered();

        diplomaToOwner[_diplomaHash] = _mcpAddress;
        emit DiplomaAdded(_mcpAddress, _diplomaHash, block.timestamp);
    }

    // --- SECTION 3.7: EPOCH-BASED STATE BATCHING PROTOCOL ---

    function updateNationalState(
        uint256 _epochNonce,
        bytes32 _proposedStateRoot,
        bytes32 _manifestHash,
        bytes calldata _aggregatedSignature
    ) external onlyActiveRole(Role.Inspector) {
       
        if (_epochNonce != currentEpochNonce + 1) revert NonceLockViolation();
        
        address consensusValidator = _recoverSigner(_manifestHash, _aggregatedSignature);
        if (users[consensusValidator].role != Role.ConsensusNode || !users[consensusValidator].isActive) {
            revert InvalidSignature();
        }

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
     * @notice Context-aware validation mechanism implementing ultra-optimized storage lookup
     * @dev Optimized with inline assembly to cut down evaluation gas to absolute minimum.
     */
    function verifyDiplomaHRABAC(
        bytes32 _mcpAddress, 
        bytes32 _calculatedHash
    ) external view onlyActiveRole(Role.Employer) returns (bool) {
        assembly {
            // Compute storage slot for diplomaToOwner[_calculatedHash]
            // diplomaToOwner is at slot 1. keccak256(key, mapping_slot)
            mstore(0x00, _calculatedHash)
            mstore(0x20, 1) // diplomaToOwner is at slot index 1
            let slot := keccak256(0x00, 0x40)
            
            let registeredMCP := sload(slot)
            
            // Check if registeredMCP == 0 OR registeredMCP != _mcpAddress
            if or(iszero(registeredMCP), mjs_not_equal(registeredMCP, _mcpAddress)) {
                mstore(0x00, 0) // Return false
                return(0x00, 0x20)
            }
            
            mstore(0x00, 1) // Return true
            return(0x00, 0x20)

            // Inline helper method for comparison within Yul scope
            function mjs_not_equal(a, b) -> res {
                res := not(eq(a, b))
            }
        }
    }

    function getStateRoot(uint256 _epochNonce) external view returns (bytes32) {
        return stateHistory[_epochNonce];
    }
}
