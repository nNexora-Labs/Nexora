// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/// @title Confidential WETH (cWETH)
/// @notice ETH <-> WETH <-> cWETH bridge using OZ ConfidentialFungibleToken
/// @dev Wrap: ETH -> WETH -> mint cWETH. Unwrap: burn cWETH, then WETH.withdraw -> send ETH.
contract ConfidentialWETH is ConfidentialFungibleToken, Ownable, SepoliaConfig, ReentrancyGuard {
    // Events (no plaintext amounts)
    event ConfidentialWrap(address indexed user);
    event ConfidentialUnwrap(address indexed user);

    // WETH contract address on Sepolia
    IWETH public constant WETH = IWETH(0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9);

    constructor(
        address owner,
        string memory name,
        string memory symbol,
        string memory uri
    ) ConfidentialFungibleToken(name, symbol, uri) Ownable(owner) {}

    /// @notice Wrap ETH to cWETH (ETH -> WETH -> cWETH)
    function wrap() external payable nonReentrant {
        require(msg.value > 0, "ConfidentialWETH: Cannot wrap 0 ETH");

        // ETH -> WETH (to this contract)
        WETH.deposit{value: msg.value}();

        // WETH -> cWETH (1:1)
        _mint(msg.sender, FHE.asEuint64(uint64(msg.value)));

        emit ConfidentialWrap(msg.sender);
    }

    /// @notice Unwrap cWETH to ETH in a single transaction
    /// @param encryptedAmount Encrypted amount to unwrap
    /// @param inputProof Proof for encrypted amount
    /// @param amount Plaintext amount to withdraw (must match encrypted amount)
    function unwrap(externalEuint64 encryptedAmount, bytes calldata inputProof, uint256 amount) external nonReentrant {
        require(amount > 0, "ConfidentialWETH: Cannot unwrap 0 ETH");
        
        // Decrypt into FHE context (still confidential on-chain)
        euint64 encryptedAmountFHE = FHE.fromExternal(encryptedAmount, inputProof);

        // Burn cWETH from caller
        _burn(msg.sender, encryptedAmountFHE);

        // Ensure we have enough WETH; withdraw directly from this contract
        require(WETH.balanceOf(address(this)) >= amount, "ConfidentialWETH: Insufficient WETH balance");

        // WETH -> ETH (ETH sent to this contract)
        WETH.withdraw(amount);

        // Send ETH to the caller
        (bool ethSuccess, ) = payable(msg.sender).call{value: amount}("");
        require(ethSuccess, "ConfidentialWETH: ETH transfer failed");

        emit ConfidentialUnwrap(msg.sender);
    }

    /// @notice Accept ETH from WETH.withdraw
    receive() external payable {}

    /// @notice Get the underlying WETH token
    function underlying() public pure returns (address) {
        return address(WETH);
    }

    /// @notice Get encrypted balance for a user (for UI)
    function getEncryptedBalance(address user) external view returns (euint64) {
        return confidentialBalanceOf(user);
    }

    /// @notice 1:1 conversion rate
    function rate() public pure returns (uint256) {
        return 1;
    }
}