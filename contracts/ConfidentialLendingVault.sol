// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IConfidentialFungibleTokenReceiver} from "@openzeppelin/confidential-contracts/interfaces/IConfidentialFungibleTokenReceiver.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Confidential Lending Vault
/// @notice ERC-4626 analogous vault for confidential lending with encrypted balances
/// @dev This contract implements only supply and withdraw functionlity 
contract ConfidentialLendingVault is Ownable, ReentrancyGuard, IConfidentialFungibleTokenReceiver, SepoliaConfig {
    using SafeERC20 for IERC20;

    // Events - CONFIDENTIAL: No plaintext amounts exposed
    event ConfidentialSupply(address indexed user);
    event ConfidentialWithdraw(address indexed user);

    IERC20 public immutable asset;
    
    mapping(address => euint64) private _encryptedShares;
    euint64 private _encryptedTotalShares;
    euint64 private _encryptedTotalAssets;
    
    // Track users who have permission to decrypt global data
    mapping(address => bool) private _canDecryptGlobals;
    address[] private _authorizedUsers;

    constructor(address _asset) Ownable(msg.sender) {
        asset = IERC20(_asset);
        _encryptedTotalShares = FHE.asEuint64(0);
        _encryptedTotalAssets = FHE.asEuint64(0);
        // Initialize with contract permissions
        FHE.allowThis(_encryptedTotalShares);
        FHE.allowThis(_encryptedTotalAssets);
    }

    /// @notice Update global permissions for a user
    /// @dev Ensures user can decrypt global vault data (total shares, total assets)
    /// @dev CRITICAL: Re-grants permissions to ALL authorized users, not just the new one
    function _updateGlobalPermissions(address newUser) private {
        // Add new user to authorized list if not already there
        if (!_canDecryptGlobals[newUser]) {
            _canDecryptGlobals[newUser] = true;
            _authorizedUsers.push(newUser);
        }
        
        // CRITICAL FIX: Re-grant permissions to ALL authorized users
        // This ensures that when a new user supplies, existing users don't lose access
        for (uint256 i = 0; i < _authorizedUsers.length; i++) {
            address user = _authorizedUsers[i];
            if (_canDecryptGlobals[user]) {
                FHE.allow(_encryptedTotalShares, user);
                FHE.allow(_encryptedTotalAssets, user);
            }
        }
        
        // Maintain contract permissions
        FHE.allowThis(_encryptedTotalShares);
        FHE.allowThis(_encryptedTotalAssets);
    }

    /// @notice Handle incoming confidential transfers from cWETH
    /// @dev This function is called when cWETH tokens are transferred to this vault
    /// @param from The address that sent the tokens
    /// @param amount The encrypted amount transferred
    /// @return ebool indicating if the transfer was accepted
    function onConfidentialTransferReceived(
        address /* operator */,
        address from,
        euint64 amount,
        bytes calldata /* data */
    ) external override returns (ebool) {
        // Only accept transfers from the cWETH contract
        require(msg.sender == address(asset), "ConfidentialLendingVault: Only cWETH transfers allowed");

        // Use euint64 directly for internal calculations
        euint64 encryptedAmount = amount;

        // Calculate shares based on current rate (encrypted)
        // For Phase 1, we'll use a simple 1:1 ratio
        euint64 encryptedShares = encryptedAmount; // 1:1 ratio for now

        // Update encrypted state - handle uninitialized balances
        euint64 currentUserShares = _encryptedShares[from];
        if (!FHE.isInitialized(currentUserShares)) {
            currentUserShares = FHE.asEuint64(0);
        }

        euint64 newUserShares = FHE.add(currentUserShares, encryptedShares);
        _encryptedShares[from] = newUserShares;

        // Update totals
        _encryptedTotalShares = FHE.add(_encryptedTotalShares, encryptedShares);
        _encryptedTotalAssets = FHE.add(_encryptedTotalAssets, encryptedAmount);

        // CRITICAL FIX: Proper permission management
        // 1. Allow user to access their own shares
        FHE.allowThis(newUserShares);
        FHE.allow(newUserShares, from);
        
        // 2. Update global permissions for this user
        _updateGlobalPermissions(from);

        // Emit CONFIDENTIAL event (no amounts exposed)
        emit ConfidentialSupply(from);

        // Return true to accept the transfer
        return FHE.asEbool(true);
    }
    /// @notice Supply cWETH to the vault by pulling tokens from user (vault is operator)
    /// @dev Flow:
    ///      1) User sets this vault as operator on cWETH (setOperator)
    ///      2) Frontend encrypts amount for THIS vault and calls supply(encryptedAmount, inputProof)
    ///      3) We convert external handle to euint64 and pull via confidentialTransferFromAndCall
    ///         which triggers onConfidentialTransferReceived to update encrypted accounting
    /// @param encryptedAmount Encrypted amount handle (externalEuint64)
    /// @param inputProof Proof for the encrypted amount (FHE input proof)
    function supply(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant {
        require(inputProof.length > 0, "Invalid input proof");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowTransient(amount, address(asset));

        euint64 transferred = ConfidentialFungibleToken(address(asset)).confidentialTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        FHE.allowThis(transferred);
        
        euint64 encryptedShares = transferred;
        
        euint64 currentUserShares = _encryptedShares[msg.sender];
        if (!FHE.isInitialized(currentUserShares)) {
            currentUserShares = FHE.asEuint64(0);
        }
        
        euint64 newUserShares = FHE.add(currentUserShares, encryptedShares);
        _encryptedShares[msg.sender] = newUserShares;
        
        // Update totals
        _encryptedTotalShares = FHE.add(_encryptedTotalShares, encryptedShares);
        _encryptedTotalAssets = FHE.add(_encryptedTotalAssets, transferred);
        
        // CRITICAL FIX: Proper permission management
        // 1. Allow user to access their own shares
        FHE.allowThis(newUserShares);
        FHE.allow(newUserShares, msg.sender);
        
        // 2. Update global permissions for this user
        _updateGlobalPermissions(msg.sender);
        
        emit ConfidentialSupply(msg.sender);
    }

    /// @notice Get encrypted shares of a user
    /// @param user The user address
    /// @return The encrypted shares
    function getEncryptedShares(address user) external view returns (euint64) {
        return _encryptedShares[user];
    }

    /// @notice Get encrypted total shares
    /// @return The encrypted total shares
    function getEncryptedTotalShares() external view returns (euint64) {
        return _encryptedTotalShares;
    }

    /// @notice Get encrypted total assets
    /// @return The encrypted total assets
    function getEncryptedTotalAssets() external view returns (euint64) {
        return _encryptedTotalAssets;
    }

    /// @notice Withdraw cWETH from the vault
    /// @dev Users can withdraw their encrypted shares as cWETH tokens
    /// @param encryptedAmount Encrypted amount to withdraw (externalEuint64)
    /// @param inputProof Proof for the encrypted amount (FHE input proof)
    /// @dev CONFIDENTIAL: No plaintext amounts are exposed
    function withdraw(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant {
        require(inputProof.length > 0, "Invalid input proof");

        euint64 withdrawalAmount = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 userShares = _encryptedShares[msg.sender];
        
        _encryptedShares[msg.sender] = FHE.sub(userShares, withdrawalAmount);
        _encryptedTotalShares = FHE.sub(_encryptedTotalShares, withdrawalAmount);
        _encryptedTotalAssets = FHE.sub(_encryptedTotalAssets, withdrawalAmount);
        
        // CRITICAL FIX: Maintain permissions after withdrawal
        FHE.allowThis(_encryptedShares[msg.sender]);
        FHE.allow(_encryptedShares[msg.sender], msg.sender);
        
        // Update global permissions (user still authorized)
        _updateGlobalPermissions(msg.sender);

        FHE.allowTransient(withdrawalAmount, address(asset));

        ConfidentialFungibleToken(address(asset)).confidentialTransferFromAndCall(
            address(this),
            msg.sender,
            withdrawalAmount,
            bytes("")
        );
        
        emit ConfidentialWithdraw(msg.sender);
    }

    /// @notice Check if a user is authorized to decrypt global data
    /// @param user The user address to check
    /// @return True if user can decrypt global vault data
    function isUserAuthorized(address user) external view returns (bool) {
        return _canDecryptGlobals[user];
    }

    /// @notice Get the total number of authorized users
    /// @return Number of users who can decrypt global data
    function getAuthorizedUserCount() external view returns (uint256) {
        return _authorizedUsers.length;
    }

}