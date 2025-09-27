// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IConfidentialFungibleTokenReceiver} from "@openzeppelin/confidential-contracts/interfaces/IConfidentialFungibleTokenReceiver.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {FHE, euint32, externalEuint32, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Confidential Lending Vault
/// @notice ERC-4626 analogous vault for confidential lending with encrypted balances
/// @dev This contract implements supply-only functionality for Phase 1
contract ConfidentialLendingVault is Ownable, ReentrancyGuard, IConfidentialFungibleTokenReceiver {
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
        // Note: In FHEVM, we work directly with encrypted values
        euint64 encryptedAmount = amount;
        
        // Calculate shares based on current rate (encrypted)
        // For Phase 1, we'll use a simple 1:1 ratio
        euint64 encryptedShares = encryptedAmount; // 1:1 ratio for now
        
        // Update encrypted state
        _encryptedShares[from] = FHE.add(_encryptedShares[from], encryptedShares);
        _encryptedTotalShares = FHE.add(_encryptedTotalShares, encryptedShares);
        _encryptedTotalAssets = FHE.add(_encryptedTotalAssets, encryptedAmount);
        
        // Allow contract and user to access encrypted values
        FHE.allowThis(_encryptedShares[from]);
        FHE.allow(_encryptedShares[from], from);
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

        // Pull tokens from user into the vault; triggers receiver hook for accounting
        euint64 transferred = ConfidentialFungibleToken(address(asset)).confidentialTransferFromAndCall(
            msg.sender,
            address(this),
            amount,
            bytes("")
        );

        // Keep access to the transferred ciphertext (optional)
        FHE.allowThis(transferred);
        // State updates occur in onConfidentialTransferReceived
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

    /// @notice Withdraw cWETH from the vault as ETH
    /// @dev Users can withdraw their encrypted shares as ETH
    /// @dev CONFIDENTIAL: No plaintext amounts are exposed
    function withdraw() external nonReentrant {
        // Get user's encrypted shares
        euint64 userShares = _encryptedShares[msg.sender];
        
        // Check if user has any shares (this will be handled by FHEVM)
        // In a real implementation, we would check if shares > 0
        
        // Calculate withdrawal amount (1:1 ratio for Phase 1)
        euint64 withdrawalAmount = userShares;
        
        // Update encrypted state
        _encryptedShares[msg.sender] = FHE.sub(_encryptedShares[msg.sender], userShares);
        _encryptedTotalShares = FHE.sub(_encryptedTotalShares, userShares);
        _encryptedTotalAssets = FHE.sub(_encryptedTotalAssets, withdrawalAmount);
        
        // Allow contract and user to access encrypted values
        FHE.allowThis(_encryptedShares[msg.sender]);
        FHE.allow(_encryptedShares[msg.sender], msg.sender);
        FHE.allowThis(_encryptedTotalShares);
        FHE.allowThis(_encryptedTotalAssets);
        
        // Emit CONFIDENTIAL event (no amounts exposed)
        emit ConfidentialWithdraw(msg.sender);
        
        // Note: In a real implementation, we would need to:
        // 1. Decrypt the withdrawal amount using FHEVM
        // 2. Transfer ETH to the user: payable(msg.sender).transfer(decryptedAmount)
        // 3. Handle the actual ETH transfer
        // For now, this is a placeholder that updates encrypted state
        // The actual ETH transfer would require FHEVM decryption
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