// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ============================================
// Agent Smart Wallet - ERC-4337 Compatible
// ============================================
// User-controlled wallet with session keys
// No server private keys ever!

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AgentSmartWallet is BaseAccount, EIP712 {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    // ============================================
    // State
    // ============================================
    IEntryPoint private immutable _entryPoint;

    address public owner;
    mapping(address => SessionKey) public sessionKeys;
    mapping(bytes32 => bool) public usedNonces;
    
    uint256 public constant SESSION_KEY_EXPIRY = 1 hours;
    uint256 public constant MAX_SESSION_AMOUNT = 100 * 10**18; // $100

    // ============================================
    // Structs
    // ============================================
    struct SessionKey {
        bool authorized;
        uint256 expiry;
        uint256 maxAmount;
        uint256 spentAmount;
        address[] allowedAgents;
        bool revoked;
    }

    struct PaymentAuthorization {
        address agent;
        uint256 amount;
        bytes32 callId;
        uint256 validUntil;
    }

    // ============================================
    // Events
    // ============================================
    event SessionKeyAuthorized(
        address indexed sessionKey,
        uint256 maxAmount,
        uint256 expiry,
        address[] allowedAgents
    );
    
    event SessionKeyRevoked(address indexed sessionKey);
    
    event PaymentSettled(
        bytes32 indexed callId,
        address indexed agent,
        uint256 amount,
        address token
    );
    
    event CallStarted(
        bytes32 indexed callId,
        address indexed agent,
        uint256 maxAmount,
        uint256 sessionKeyId
    );

    // ============================================
    // Modifiers
    // ============================================
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "Only EntryPoint");
        _;
    }

    modifier onlySessionKey(address sessionKey) {
        SessionKey storage sk = sessionKeys[sessionKey];
        require(sk.authorized, "Not authorized");
        require(!sk.revoked, "Session revoked");
        require(block.timestamp < sk.expiry, "Session expired");
        _;
    }

    // ============================================
    // Constructor
    // ============================================
    constructor(IEntryPoint entryPoint_, address _owner)
        EIP712("AgentSmartWallet", "1")
    {
        _entryPoint = entryPoint_;
        owner = _owner;
    }

    // ============================================
    // ERC-4337 Required Functions
    // ============================================
    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address signer = hash.recover(userOp.signature);

        // Owner can always sign
        if (signer == owner) {
            return 0; // Valid
        }

        // Session keys can sign within their constraints
        SessionKey storage sk = sessionKeys[signer];
        if (sk.authorized && !sk.revoked && block.timestamp < sk.expiry) {
            // Check if call is to allowed agent
            (address target, bytes memory callData) = abi.decode(
                userOp.callData[4:], // Skip selector
                (address, bytes)
            );
            
            // Decode the actual call to check agent
            (address agent, uint256 amount, ) = abi.decode(
                callData[4:], // Skip settlePayment selector
                (address, uint256, bytes32)
            );

            // Verify agent is allowed
            bool agentAllowed = false;
            for (uint i = 0; i < sk.allowedAgents.length; i++) {
                if (sk.allowedAgents[i] == agent) {
                    agentAllowed = true;
                    break;
                }
            }

            if (!agentAllowed) {
                return 1; // Invalid
            }

            // Verify amount within limit
            if (amount > sk.maxAmount - sk.spentAmount) {
                return 1; // Invalid
            }

            return 0; // Valid
        }

        return 1; // Invalid
    }

    // ============================================
    // Session Key Management (Owner Only)
    // ============================================
    function authorizeSessionKey(
        address sessionKey,
        uint256 maxAmount,
        uint256 duration,
        address[] calldata allowedAgents
    ) external onlyOwner {
        require(maxAmount <= MAX_SESSION_AMOUNT, "Amount too high");
        require(duration <= SESSION_KEY_EXPIRY, "Duration too long");
        require(allowedAgents.length > 0, "No agents allowed");

        sessionKeys[sessionKey] = SessionKey({
            authorized: true,
            expiry: block.timestamp + duration,
            maxAmount: maxAmount,
            spentAmount: 0,
            allowedAgents: allowedAgents,
            revoked: false
        });

        emit SessionKeyAuthorized(
            sessionKey,
            maxAmount,
            block.timestamp + duration,
            allowedAgents
        );
    }

    function revokeSessionKey(address sessionKey) external onlyOwner {
        SessionKey storage sk = sessionKeys[sessionKey];
        require(sk.authorized, "Not authorized");
        
        sk.revoked = true;
        
        emit SessionKeyRevoked(sessionKey);
    }

    // ============================================
    // Payment Functions (Session Key or Owner)
    // ============================================
    function settlePayment(
        address agent,
        uint256 amount,
        bytes32 callId,
        address token
    ) external onlySessionKey(msg.sender) {
        SessionKey storage sk = sessionKeys[msg.sender];
        
        // Check agent is allowed
        bool agentAllowed = false;
        for (uint i = 0; i < sk.allowedAgents.length; i++) {
            if (sk.allowedAgents[i] == agent) {
                agentAllowed = true;
                break;
            }
        }
        require(agentAllowed, "Agent not allowed");

        // Check amount
        require(
            amount <= sk.maxAmount - sk.spentAmount,
            "Exceeds session limit"
        );

        // Update spent
        sk.spentAmount += amount;

        // Transfer tokens
        IERC20(token).safeTransfer(agent, amount);

        emit PaymentSettled(callId, agent, amount, token);
    }

    function settlePaymentWithAuthorization(
        PaymentAuthorization calldata auth,
        bytes calldata signature,
        address token
    ) external {
        // Verify authorization signature
        bytes32 structHash = keccak256(abi.encode(
            keccak256("PaymentAuthorization(address agent,uint256 amount,bytes32 callId,uint256 validUntil)"),
            auth.agent,
            auth.amount,
            auth.callId,
            auth.validUntil
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);

        // Must be owner or valid session key
        SessionKey storage sk = sessionKeys[signer];
        bool isAuthorized = (signer == owner) || 
            (sk.authorized && !sk.revoked && block.timestamp < sk.expiry);
        
        require(isAuthorized, "Not authorized");
        require(block.timestamp < auth.validUntil, "Authorization expired");
        require(!usedNonces[auth.callId], "Already used");

        usedNonces[auth.callId] = true;

        // Transfer
        IERC20(token).safeTransfer(auth.agent, auth.amount);

        emit PaymentSettled(auth.callId, auth.agent, auth.amount, token);
    }

    // ============================================
    // Call Management
    // ============================================
    function startCall(
        address agent,
        uint256 maxAmount,
        address sessionKey,
        bytes32 callId
    ) external onlySessionKey(sessionKey) {
        SessionKey storage sk = sessionKeys[sessionKey];
        
        require(
            maxAmount <= sk.maxAmount - sk.spentAmount,
            "Insufficient session balance"
        );

        emit CallStarted(callId, agent, maxAmount, uint256(uint160(sessionKey)));
    }

    // ============================================
    // Batch Operations (Gas Optimization)
    // ============================================
    function executeBatch(
        address[] calldata targets,
        bytes[] calldata data,
        uint256[] calldata values
    ) external onlyOwner {
        require(
            targets.length == data.length && data.length == values.length,
            "Length mismatch"
        );

        for (uint i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(data[i]);
            require(success, "Batch call failed");
        }
    }

    // ============================================
    // View Functions
    // ============================================
    function getSessionKeyInfo(address sessionKey)
        external
        view
        returns (SessionKey memory)
    {
        return sessionKeys[sessionKey];
    }

    function getRemainingSessionBalance(address sessionKey)
        external
        view
        returns (uint256)
    {
        SessionKey storage sk = sessionKeys[sessionKey];
        if (!sk.authorized || sk.revoked || block.timestamp >= sk.expiry) {
            return 0;
        }
        return sk.maxAmount - sk.spentAmount;
    }

    // ============================================
    // Emergency Functions
    // ============================================
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(owner, balance);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    // ============================================
    // Receive
    // ============================================
    receive() external payable {}
}

// ============================================
// Factory for Creating Smart Wallets
// ============================================
contract AgentSmartWalletFactory {
    IEntryPoint public immutable entryPoint;
    mapping(address => address) public walletOf;

    event WalletCreated(address indexed owner, address indexed wallet);

    constructor(IEntryPoint entryPoint_) {
        entryPoint = entryPoint_;
    }

    function createWallet(address owner) external returns (address wallet) {
        require(walletOf[owner] == address(0), "Wallet exists");

        wallet = address(new AgentSmartWallet(entryPoint, owner));
        walletOf[owner] = wallet;
        
        emit WalletCreated(owner, wallet);
    }

    function getWallet(address owner) external view returns (address) {
        return walletOf[owner];
    }
}
