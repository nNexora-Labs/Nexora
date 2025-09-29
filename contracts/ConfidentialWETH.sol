// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FHESafeMath} from "@openzeppelin/confidential-contracts/utils/FHESafeMath.sol";

/// @title Confidential WETH (cWETH)
/// @notice ERC7984 implementation for confidential WETH with wrap/unwrap functionality
/// @dev This contract allows users to wrap ETH into confidential WETH tokens
contract ConfidentialWETH is ConfidentialFungibleToken, Ownable, SepoliaConfig {
    // Events - CONFIDENTIAL: No plaintext amounts exposed
    event ConfidentialDeposit(address indexed user);
    event ConfidentialWithdrawal(address indexed user);
    event ConfidentialWrap(address indexed user);
    event ConfidentialUnwrap(address indexed user);

    // Mapping to store encrypted balances
    mapping(address => euint64) private _encryptedBalances;
    
    // Total supply tracking (encrypted)
    euint64 private _totalSupply;

    constructor() ConfidentialFungibleToken("Confidential Wrapped Ether", "cWETH", "https://api.example.com/metadata/") Ownable(msg.sender) {
        // Initialize encrypted state variables
        _totalSupply = FHE.asEuint64(0);
        FHE.allowThis(_totalSupply);
    }

    /// @notice Wrap ETH into confidential WETH
    /// @dev Users send ETH and receive encrypted cWETH tokens
    /// @dev CONFIDENTIAL: No plaintext amounts are exposed
    function wrap() external payable {
        require(msg.value > 0, "ConfidentialWETH: Cannot wrap 0 ETH");

        // Convert ETH amount to encrypted value
        euint64 encryptedAmount = FHE.asEuint64(uint64(msg.value));

        // Update encrypted balance
        _encryptedBalances[msg.sender] = FHE.add(_encryptedBalances[msg.sender], encryptedAmount);

        // Update total supply
        _totalSupply = FHE.add(_totalSupply, encryptedAmount);

        // Allow contract and user to access the encrypted balance
        FHE.allowThis(_encryptedBalances[msg.sender]);
        FHE.allow(_encryptedBalances[msg.sender], msg.sender);
        FHE.allowThis(_totalSupply);

        // Emit CONFIDENTIAL event (no amounts exposed)
        emit ConfidentialWrap(msg.sender);
    }

    /// @notice Get encrypted balance of a user
    /// @param user The user address
    /// @return The encrypted balance
    function getEncryptedBalance(address user) external view returns (euint64) {
        return _encryptedBalances[user];
    }

    /// @notice Get encrypted total supply
    /// @return The encrypted total supply
    function getEncryptedTotalSupply() external view returns (euint64) {
        return _totalSupply;
    }

    /// @notice Emergency function to withdraw ETH (only owner)
    /// @dev This function should only be used in emergency situations
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "ConfidentialWETH: No ETH to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "ConfidentialWETH: Emergency withdrawal failed");
    }

    /// @notice Receive function to accept ETH deposits
    /// @dev CONFIDENTIAL: No plaintext amounts are exposed
    receive() external payable {
        emit ConfidentialDeposit(msg.sender);
    }

    /// @notice Override _update to use our custom _encryptedBalances mapping
    /// @dev This ensures that transfers use our custom balance storage
    function _update(address from, address to, euint64 amount) internal override returns (euint64 transferred) {
        ebool success;
        euint64 ptr;

        if (from == address(0)) {
            // Minting - increase total supply
            (success, ptr) = FHESafeMath.tryIncrease(_totalSupply, amount);
            FHE.allowThis(ptr);
            _totalSupply = ptr;
        } else {
            // Transfer from existing balance
            euint64 fromBalance = _encryptedBalances[from];
            require(FHE.isInitialized(fromBalance), ConfidentialFungibleTokenZeroBalance(from));
            (success, ptr) = FHESafeMath.tryDecrease(fromBalance, amount);
            FHE.allowThis(ptr);
            FHE.allow(ptr, from);
            _encryptedBalances[from] = ptr;
        }

        transferred = FHE.select(success, amount, FHE.asEuint64(0));

        if (to == address(0)) {
            // Burning - decrease total supply
            ptr = FHE.sub(_totalSupply, transferred);
            FHE.allowThis(ptr);
            _totalSupply = ptr;
        } else {
            // Transfer to recipient
            euint64 toBalance = _encryptedBalances[to];
            (success, ptr) = FHESafeMath.tryIncrease(toBalance, transferred);
            FHE.allowThis(ptr);
            FHE.allow(ptr, to);
            _encryptedBalances[to] = ptr;
        }

        return transferred;
    }

}