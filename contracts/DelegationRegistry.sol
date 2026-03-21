// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DelegationRegistry
 * @dev Custom delegation registry for agent permissions
 * This contract manages delegations between agents and users
 */
contract DelegationRegistry {
    struct DelegationScope {
        bool canBook;
        bool canOrder;
        bool canSchedule;
        bool canResearch;
        uint256 maxSpend;
        uint256 expiresAt;
    }

    struct Delegation {
        address delegator;
        address delegate;
        DelegationScope scope;
        uint256 createdAt;
        uint256 revokedAt;
    }

    mapping(bytes32 => Delegation) public delegations;
    mapping(address => bytes32[]) public activeDelegations;
    
    event DelegationCreated(
        bytes32 indexed delegationId,
        address indexed delegator,
        address indexed delegate,
        DelegationScope scope
    );
    
    event DelegationRevoked(
        bytes32 indexed delegationId,
        address indexed revoker
    );

    /**
     * @dev Create a new delegation
     * @param delegate Address of the delegate
     * @param scope Delegation permissions scope
     * @return delegationId Unique identifier for the delegation
     */
    function createDelegation(
        address delegate,
        DelegationScope calldata scope
    ) external returns (bytes32) {
        require(delegate != address(0), "Delegate cannot be zero address");
        require(scope.expiresAt > block.timestamp, "Expiration must be in the future");
        
        bytes32 delegationId = keccak256(
            abi.encodePacked(
                msg.sender,
                delegate,
                block.timestamp,
                block.difficulty
            )
        );
        
        Delegation storage delegation = delegations[delegationId];
        delegation.delegator = msg.sender;
        delegation.delegate = delegate;
        delegation.scope = scope;
        delegation.createdAt = block.timestamp;
        delegation.revokedAt = 0;
        
        activeDelegations[msg.sender].push(delegationId);
        
        emit DelegationCreated(delegationId, msg.sender, delegate, scope);
        
        return delegationId;
    }

    /**
     * @dev Verify if a delegation is valid for a specific action
     * @param delegationId ID of the delegation
     * @param action Action to verify (book, order, schedule, research)
     * @return isValid Whether the delegation is valid for the action
     */
    function verifyDelegation(
        bytes32 delegationId,
        string calldata action
    ) external view returns (bool isValid) {
        Delegation storage delegation = delegations[delegationId];
        
        // Check if delegation exists
        if (delegation.createdAt == 0) {
            return false;
        }
        
        // Check if delegation is revoked
        if (delegation.revokedAt > 0) {
            return false;
        }
        
        // Check if delegation has expired
        if (delegation.scope.expiresAt < block.timestamp) {
            return false;
        }
        
        // Check action permission
        if (keccak256(bytes(action)) == keccak256(bytes("book"))) {
            return delegation.scope.canBook;
        } else if (keccak256(bytes(action)) == keccak256(bytes("order"))) {
            return delegation.scope.canOrder;
        } else if (keccak256(bytes(action)) == keccak256(bytes("schedule"))) {
            return delegation.scope.canSchedule;
        } else if (keccak256(bytes(action)) == keccak256(bytes("research"))) {
            return delegation.scope.canResearch;
        }
        
        return false;
    }

    /**
     * @dev Revoke a delegation
     * @param delegationId ID of the delegation to revoke
     */
    function revokeDelegation(bytes32 delegationId) external {
        Delegation storage delegation = delegations[delegationId];
        
        require(delegation.delegator == msg.sender, "Only delegator can revoke");
        require(delegation.revokedAt == 0, "Delegation already revoked");
        
        delegation.revokedAt = block.timestamp;
        
        emit DelegationRevoked(delegationId, msg.sender);
    }

    /**
     * @dev Get delegation details
     * @param delegationId ID of the delegation
     * @return delegator Address of the delegator
     * @return delegate Address of the delegate
     * @return scope Delegation permissions scope
     * @return createdAt Creation timestamp
     * @return revokedAt Revocation timestamp (0 if not revoked)
     */
    function getDelegation(bytes32 delegationId) external view returns (
        address delegator,
        address delegate,
        DelegationScope memory scope,
        uint256 createdAt,
        uint256 revokedAt
    ) {
        Delegation storage d = delegations[delegationId];
        return (d.delegator, d.delegate, d.scope, d.createdAt, d.revokedAt);
    }

    /**
     * @dev Get all active delegations for a delegator
     * @param delegator Address of the delegator
     * @return delegationIds Array of active delegation IDs
     */
    function getActiveDelegations(address delegator) external view returns (bytes32[] memory) {
        bytes32[] memory allDelegations = activeDelegations[delegator];
        uint256 activeCount = 0;
        
        // First pass: count active delegations
        for (uint256 i = 0; i < allDelegations.length; i++) {
            Delegation storage d = delegations[allDelegations[i]];
            if (d.revokedAt == 0 && d.scope.expiresAt > block.timestamp) {
                activeCount++;
            }
        }
        
        // Second pass: populate array
        bytes32[] memory activeDelegationIds = new bytes32[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allDelegations.length; i++) {
            Delegation storage d = delegations[allDelegations[i]];
            if (d.revokedAt == 0 && d.scope.expiresAt > block.timestamp) {
                activeDelegationIds[index] = allDelegations[i];
                index++;
            }
        }
        
        return activeDelegationIds;
    }
}