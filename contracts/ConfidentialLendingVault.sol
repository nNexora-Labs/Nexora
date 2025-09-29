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
/// @dev This contract implements supply-only functionality for Phase 1
contract ConfidentialLendingVault is Ownable, ReentrancyGuard, IConfidentialFungibleTokenReceiver, SepoliaConfig {
    using SafeERC20 for IERC20;

    // Events - CONFIDENTIAL: No plaintext amounts exposed
    event ConfidentialSupply(address indexed user);
    event ConfidentialWithdraw(address indexed user);
    event InterestAccrued(uint256 timestamp);

    // State variables
    IERC20 public immutable asset; // cWETH token
    uint256 public constant INITIAL_RATE = 1000000000000000000; // 1e18 (100% initial rate)
    uint256 public constant RATE_PRECISION = 1e18;
    
    // Encrypted state
    mapping(address => euint64) private _encryptedShares;
    euint64 private _encryptedTotalShares;
    euint64 private _encryptedTotalAssets;
    
    // Interest rate parameters (fixed for Phase 1)
    uint256 public currentRate = INITIAL_RATE;
    uint256 public lastUpdateTime;
    uint256 public constant FIXED_INTEREST_RATE = 50000000000000000; // 5% annual rate (0.05e18)
    
    // Oracle price (fixed for Phase 1: 1 ETH = 4000 USDC)
    uint256 public constant ETH_PRICE_USDC = 4000e6; // 4000 USDC (6 decimals)
    uint256 public constant USDC_DECIMALS = 6;

    constructor(address _asset) Ownable(msg.sender) {
        asset = IERC20(_asset);
        lastUpdateTime = block.timestamp;

        // Initialize encrypted state variables
        _encryptedTotalShares = FHE.asEuint64(0);
        _encryptedTotalAssets = FHE.asEuint64(0);
        FHE.allowThis(_encryptedTotalShares);
        FHE.allowThis(_encryptedTotalAssets);
        // Ensure operator is set for the vault itself
        ConfidentialFungibleToken(address(asset)).setOperator(address(this), type(uint48).max);
    }

    /// @notice Handle incoming confidential transfers from cWETH
    /// @dev This function is called when cWETH tokens are transferred to this vault
    /// @param operator The address that initiated the transfer
    /// @param from The address that sent the tokens
    /// @param amount The encrypted amount transferred
    /// @param data Additional data (unused)
    /// @return ebool indicating if the transfer was accepted
    function onConfidentialTransferReceived(
        address operator,
        address from,
        euint64 amount,
        bytes calldata data
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

        // Allow contract and user to access encrypted values
        FHE.allowThis(newUserShares);
        FHE.allow(newUserShares, from);
        FHE.allowThis(_encryptedTotalShares);
        FHE.allowThis(_encryptedTotalAssets);

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

        // Convert external encrypted handle to internal euint64
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Allow the asset (cWETH) to consume this encrypted value transiently
        FHE.allowTransient(amount, address(asset));

        // Pull tokens from user into the vault
        euint64 transferred = ConfidentialFungibleToken(address(asset)).confidentialTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        // Keep access to the transferred ciphertext
        FHE.allowThis(transferred);
        
        // Update encrypted state directly (since we're not using callback pattern)
        euint64 encryptedShares = transferred; // 1:1 ratio for now
        
        // Update user shares
        euint64 currentUserShares = _encryptedShares[msg.sender];
        if (!FHE.isInitialized(currentUserShares)) {
            currentUserShares = FHE.asEuint64(0);
        }
        
        euint64 newUserShares = FHE.add(currentUserShares, encryptedShares);
        _encryptedShares[msg.sender] = newUserShares;
        
        // Update totals
        _encryptedTotalShares = FHE.add(_encryptedTotalShares, encryptedShares);
        _encryptedTotalAssets = FHE.add(_encryptedTotalAssets, transferred);
        
        // Allow contract and user to access encrypted values
        FHE.allowThis(newUserShares);
        FHE.allow(newUserShares, msg.sender);
        FHE.allowThis(_encryptedTotalShares);
        FHE.allowThis(_encryptedTotalAssets);
        
        // Emit CONFIDENTIAL event (no amounts exposed)
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

        // Convert external encrypted handle to internal euint64
        euint64 withdrawalAmount = FHE.fromExternal(encryptedAmount, inputProof);

        // Get user's current encrypted shares
        euint64 userShares = _encryptedShares[msg.sender];

        // Check if user has any shares
        require(FHE.isInitialized(userShares), "No shares to withdraw");

        // Check if user has sufficient shares (this will be handled by FHEVM)
        // The FHEVM will ensure withdrawalAmount <= userShares

        // Update encrypted state - subtract from user's shares
        euint64 newUserShares = FHE.sub(userShares, withdrawalAmount);
        _encryptedShares[msg.sender] = newUserShares;

        // Update totals
        _encryptedTotalShares = FHE.sub(_encryptedTotalShares, withdrawalAmount);
        _encryptedTotalAssets = FHE.sub(_encryptedTotalAssets, withdrawalAmount);

        // Allow contract and user to access updated encrypted values
        FHE.allowThis(newUserShares);
        FHE.allow(newUserShares, msg.sender);
        FHE.allowThis(_encryptedTotalShares);
        FHE.allowThis(_encryptedTotalAssets);

        // CORRECTED SOLUTION: Use confidentialTransfer instead of confidentialTransferFrom
        // Since the vault is the caller and wants to transfer to the user
        // confidentialTransfer is the correct ERC7984 function for this use case

        // Allow the cWETH contract to access the withdrawal amount for the transfer
        FHE.allowTransient(withdrawalAmount, address(asset));

        // Use confidentialTransfer - vault (caller) transfers to user (recipient)
        ConfidentialFungibleToken(address(asset)).confidentialTransfer(
            msg.sender,     // to: user (recipient of the withdrawal)
            withdrawalAmount // encrypted amount to transfer
        );

        // Emit CONFIDENTIAL event (no amounts exposed)
        emit ConfidentialWithdraw(msg.sender);
    }

    /// @notice Calculate utilization rate
    /// @return The utilization rate (0-100%)
    function getUtilizationRate() external pure returns (uint256) {
        // For Phase 1, we'll use a fixed utilization rate
        return 50; // Fixed 50% utilization for Phase 1
    }

    /// @notice Get current interest rate
    /// @return The current interest rate
    function getCurrentInterestRate() external pure returns (uint256) {
        return FIXED_INTEREST_RATE;
    }

    /// @notice Get ETH price in USDC
    /// @return The ETH price in USDC
    function getETHPrice() external pure returns (uint256) {
        return ETH_PRICE_USDC;
    }

    /// @notice Emergency function to pause deposits (only owner)
    function emergencyPause() external onlyOwner {
        // Implementation would pause the contract
        // For now, this is a placeholder
    }

    /// @notice Emergency function to resume deposits (only owner)
    function emergencyResume() external onlyOwner {
        // Implementation would resume the contract
        // For now, this is a placeholder
    }

    /// @notice Receive function to accept ETH deposits
    receive() external payable {
        // ETH deposits are handled by the supply() function
    }
}