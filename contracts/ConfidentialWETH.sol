// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title Confidential WETH (cWETH) - OpenZeppelin Pattern
/// @notice ERC7984 implementation for confidential WETH following OpenZeppelin patterns
/// @dev Uses ETH -> WETH -> cWETH and cWETH -> WETH -> ETH flow
contract ConfidentialWETH is ConfidentialFungibleToken, Ownable, SepoliaConfig {
    using SafeERC20 for IERC20;

    // Events - CONFIDENTIAL: No plaintext amounts exposed
    event ConfidentialWrap(address indexed user);
    event ConfidentialUnwrap(address indexed user);

    // WETH contract address on Sepolia
    IERC20 public constant WETH = IERC20(0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9);

    constructor(
        address owner,
        string memory name,
        string memory symbol,
        string memory uri
    ) ConfidentialFungibleToken(name, symbol, uri) Ownable(owner) {}

    /// @notice Wrap ETH to cWETH (ETH -> WETH -> cWETH)
    /// @dev User sends ETH, contract wraps to WETH, then mints cWETH
    function wrap() external payable {
        require(msg.value > 0, "ConfidentialWETH: Cannot wrap 0 ETH");

        // Step 1: ETH -> WETH (using WETH's deposit function)
        // Call WETH.deposit() to convert ETH to WETH
        (bool success, ) = address(WETH).call{value: msg.value}(
            abi.encodeWithSignature("deposit()")
        );
        require(success, "ConfidentialWETH: WETH deposit failed");

        // Step 2: Transfer WETH from WETH contract to this contract
        // The WETH contract now holds the WETH, we need to transfer it here
        // Note: WETH.deposit() creates WETH tokens for the caller (this contract)
        // So we already have the WETH tokens in this contract

        // Step 3: WETH -> cWETH (using OpenZeppelin pattern)
        uint256 wethAmount = msg.value; // 1:1 rate for ETH:WETH
        uint256 cWETHAmount = wethAmount; // 1:1 rate for WETH:cWETH

        // Mint cWETH tokens to user
        _mint(msg.sender, FHE.asEuint64(uint64(cWETHAmount)));

        emit ConfidentialWrap(msg.sender);
    }

    /// @notice Unwrap cWETH to ETH (cWETH -> WETH -> ETH)
    /// @dev Burns cWETH, unwraps WETH to ETH, sends ETH to user
    /// @param amountInput The encrypted amount to unwrap
    /// @param inputProof The proof for the encrypted amount
    function unwrap(externalEuint64 amountInput, bytes calldata inputProof) external {
        // Step 1: cWETH -> WETH (using OpenZeppelin pattern)
        euint64 amount = FHE.fromExternal(amountInput, inputProof);
        
        // Burn the cWETH tokens
        _burn(msg.sender, amount);

        // Emit event - the actual ETH transfer will be handled by completeUnwrap
        emit ConfidentialUnwrap(msg.sender);
    }

    /// @notice Complete the unwrap process by sending ETH
    /// @dev This function should be called after unwrap to actually send ETH
    /// @param amount The amount of ETH to send (must match the burned cWETH amount)
    function completeUnwrap(uint256 amount) external {
        require(amount > 0, "ConfidentialWETH: Cannot unwrap 0 ETH");

        // Step 2: WETH -> ETH
        // Transfer WETH from this contract to WETH contract for withdrawal
        WETH.safeTransfer(address(WETH), amount);

        // Call WETH.withdraw() to convert WETH to ETH
        (bool success, ) = address(WETH).call(
            abi.encodeWithSignature("withdraw(uint256)", amount)
        );
        require(success, "ConfidentialWETH: WETH withdraw failed");

        // Send ETH to user
        (bool ethSuccess, ) = msg.sender.call{value: amount}("");
        require(ethSuccess, "ConfidentialWETH: ETH transfer failed");
    }

    /// @notice Get the underlying WETH token
    /// @return The WETH token address
    function underlying() public pure returns (address) {
        return address(WETH);
    }

    /// @notice Get the conversion rate (1:1 for ETH:WETH:cWETH)
    /// @return The conversion rate
    function rate() public pure returns (uint256) {
        return 1;
    }

    /// @notice Get encrypted balance for a user
    /// @dev Required by the dashboard to display encrypted balances
    /// @param user The user address to get balance for
    /// @return The encrypted balance as euint64
    function getEncryptedBalance(address user) external view returns (euint64) {
        return confidentialBalanceOf(user);
    }
}