# Confidential Lending Protocol

A fully end-to-end encrypted lending protocol using Zama fhevm that focuses on ETH supply functionality. This is Phase 1 of a larger confidential DeFi protocol built for the Zama Developer Program.

## 🚀 Try the Live Application

**Ready to test?** The protocol is live and deployed! Connect your wallet and start using confidential ETH lending features immediately.

## 🚀 Features

- **Full FHE Encryption**: All balances and sensitive user data are encrypted using Zama's FHE technology
- **Confidential WETH**: ERC7984 implementation for confidential Wrapped Ether
- **Lending Vault**: ERC-4626 analogous vault for confidential lending
- **Supply Flow**: ETH → WETH → cWETH → Vault
- **Withdraw Flow**: Encrypted shares → Decrypt → Withdraw ETH
- **Modern Frontend**: Next.js + React + TypeScript + Material-UI
- **Wallet Integration**: WalletConnect + Wagmi + Viem
- **Zama Relayer**: Client-side decryption for UI display

## 🏗️ Architecture

### Smart Contracts
- `ConfidentialWETH.sol`: ERC7984 implementation for confidential WETH
- `ConfidentialLendingVault.sol`: ERC-4626 analogous vault for lending
- `ZamaConfig.sol`: Sepolia network configuration (imported from Zama package)

### Frontend
- **Framework**: Next.js 14 with App Router
- **UI**: Material-UI components with tabs for Supply/Withdraw
- **Web3**: Wagmi + Viem for blockchain interaction
- **Wallet**: WalletConnect integration
- **FHE**: Zama Relayer SDK for encrypted operations
- **Components**: Dashboard, SupplyForm, WithdrawForm, useSuppliedBalance hook

## 🛠️ Setup

### Prerequisites
- Node.js >= 20
- npm >= 7.0.0
- Hardhat
- WalletConnect Project ID
- Sepolia RPC URL

### Smart Contract Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Create .env file in the root directory
touch .env
# Add the following variables to .env:
```

### Required Environment Variables (Root Directory)

Create a `.env` file in the root directory with the following variables:

```bash
# Private Key for Deployment (REQUIRED)
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Infura API Key (REQUIRED for Sepolia deployment)
INFURA_API_KEY=your_infura_project_id_here

# Etherscan API Key (OPTIONAL - for contract verification)
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# Gas Reporting (OPTIONAL)
REPORT_GAS=true
```

**Important Notes:**
- `PRIVATE_KEY`: Your wallet private key (without 0x prefix is also accepted)
- `INFURA_API_KEY`: Get from [Infura](https://infura.io/) - required for Sepolia testnet
- `ETHERSCAN_API_KEY`: Get from [Etherscan](https://etherscan.io/apis) - for contract verification
- **Never commit your `.env` file to version control!**

3. Compile contracts:
```bash
npm run compile
```

4. Run tests:
```bash
npm test
```

5. Deploy to Sepolia:
```bash
npx hardhat deploy --network sepolia
```

### Frontend Setup

1. Navigate to webapp directory:
```bash
cd webapp
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
# Fill in your environment variables as described below
```

### Required Environment Variables (Webapp Directory)

Create a `.env.local` file in the `webapp/` directory with the following variables:

```bash
# RPC Configuration (REQUIRED)
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
NEXT_PUBLIC_CHAIN_ID=11155111

# Contract Addresses (REQUIRED)
NEXT_PUBLIC_VAULT_ADDRESS=0x465f1FDD80961ed5D2ed1EBfB85706dB45EFfCBc
NEXT_PUBLIC_CWETH_ADDRESS=0x113b5EC363f94465F7E5c3B7eED8136DeE80c24a

# Optional: Analytics and Monitoring
NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id_here

# Development only (not needed for production)
# NODE_ENV=production
```

**Variable Descriptions:**
- `NEXT_PUBLIC_RPC_URL`: Sepolia testnet RPC URL (Infura/Alchemy)
- `NEXT_PUBLIC_CHAIN_ID`: Sepolia chain ID (11155111)
- `NEXT_PUBLIC_VAULT_ADDRESS`: Deployed ConfidentialLendingVault contract address
- `NEXT_PUBLIC_CWETH_ADDRESS`: Deployed ConfidentialWETH contract address
- `NEXT_PUBLIC_ANALYTICS_ID`: Optional analytics tracking ID

**Quick Setup with Pre-deployed Contracts:**
```bash
# Copy the example file
cp env.example .env.local

# Update with your Infura key
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Use the pre-deployed contract addresses (already set in env.example)
NEXT_PUBLIC_VAULT_ADDRESS=0x465f1FDD80961ed5D2ed1EBfB85706dB45EFfCBc
NEXT_PUBLIC_CWETH_ADDRESS=0x113b5EC363f94465F7E5c3B7eED8136DeE80c24a
```

**Note:** Zama Relayer SDK uses SepoliaConfig automatically - no additional configuration needed for FHE operations.

4. Run development server:
```bash
npm run dev
```

## 📋 Environment Variables Summary

### Root Directory (`.env`)
Required for smart contract deployment and testing:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PRIVATE_KEY` | ✅ | Wallet private key for deployment | `0x1234...abcd` |
| `INFURA_API_KEY` | ✅ | Infura project ID for Sepolia | `your_infura_key` |
| `ETHERSCAN_API_KEY` | ❌ | For contract verification | `your_etherscan_key` |
| `REPORT_GAS` | ❌ | Enable gas reporting | `true` |

### Webapp Directory (`.env.local`)
Required for frontend application:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_RPC_URL` | ✅ | Sepolia RPC endpoint | `https://sepolia.infura.io/v3/...` |
| `NEXT_PUBLIC_CHAIN_ID` | ✅ | Sepolia chain ID | `11155111` |
| `NEXT_PUBLIC_VAULT_ADDRESS` | ✅ | Vault contract address | `0x465f...fCBc` |
| `NEXT_PUBLIC_CWETH_ADDRESS` | ✅ | cWETH contract address | `0x113b...c24a` |
| `NEXT_PUBLIC_ANALYTICS_ID` | ❌ | Analytics tracking | `your_analytics_id` |

### 🔐 Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use testnet keys** for development (never mainnet private keys)
3. **Rotate keys regularly** in production
4. **Use environment-specific files** (`.env.local`, `.env.production`)
5. **Validate all inputs** before using environment variables

## 🔐 Security Features

- **FHE Proofs**: All encrypted inputs require proper FHE proofs via `FHE.asEuint(input, proof)`
- **Access Control**: Ownable pattern for administrative functions
- **Reentrancy Protection**: ReentrancyGuard for supply/withdraw functions
- **Safe Math**: OpenZeppelin's SafeERC20 for token operations
- **Input Validation**: Proper checks for insufficient balances and invalid proofs

## 📊 Key Metrics

- **Interest Rate**: 5% APY (fixed for Phase 1)
- **ETH Price**: $4,000 USDC (fixed oracle)
- **Utilization Rate**: 50% (fixed for Phase 1)
- **Conversion Rate**: 1:1 ETH to cWETH

## 🧪 Testing

The project includes comprehensive tests covering:
- Contract deployment and initialization
- ETH wrapping/unwrapping functionality
- Supply and withdrawal operations
- Access control and security measures
- Integration tests for complete flows

Run tests with:
```bash
npm test
```

## 🚀 Deployment

### Sepolia Testnet
1. Ensure you have Sepolia ETH for gas fees
2. Deploy contracts:
```bash
npx hardhat deploy --network sepolia
```
3. Update frontend environment variables with deployed contract addresses
4. Deploy frontend to Vercel or similar platform

## 📋 Deployed Contract Addresses (Sepolia Testnet)

### Ready-to-Use Addresses
For users who want to test the application immediately, you can use these pre-deployed contract addresses:

```bash
# Add these to your webapp/.env.local file:
NEXT_PUBLIC_CWETH_ADDRESS=0x113b5EC363f94465F7E5c3B7eED8136DeE80c24a
NEXT_PUBLIC_VAULT_ADDRESS=0x465f1FDD80961ed5D2ed1EBfB85706dB45EFfCBc
```

### Contract Details
- **ConfidentialWETH (cWETH)**: `0x113b5EC363f94465F7E5c3B7eED8136DeE80c24a`
  - Handles ETH ↔ cWETH conversion with FHE encryption
  - Implements ERC7984 standard for confidential tokens
  
- **ConfidentialLendingVault**: `0x465f1FDD80961ed5D2ed1EBfB85706dB45EFfCBc`
  - Manages confidential lending with encrypted shares
  - Implements ERC-4626 analogous vault for lending

### Verification
You can verify these contracts on Sepolia Etherscan:
- [cWETH Contract](https://sepolia.etherscan.io/address/0x113b5EC363f94465F7E5c3B7eED8136DeE80c24a)
- [Vault Contract](https://sepolia.etherscan.io/address/0x465f1FDD80961ed5D2ed1EBfB85706dB45EFfCBc)

## 🎯 Phase 1 Success Metrics

- ✅ User can connect wallet
- ✅ User can see ETH balance
- ✅ User can supply ETH (converted to cWETH)
- ✅ Supply is properly encrypted and recorded
- ✅ Frontend displays encrypted balance information

## 🔮 Future Phases

- **Phase 2**: Borrowing functionality
- **Phase 3**: Dynamic interest rates
- **Phase 4**: Multi-asset support
- **Phase 5**: Advanced DeFi features

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

This project is built for the Zama Developer Program. Contributions and feedback are welcome!

## 🌐 Live Application

**Try the Protocol Now:**
🚀 **[https://nexora-sooty-alpha.vercel.app/](https://nexora-sooty-alpha.vercel.app/)**

The Confidential Lending Protocol is live on Vercel and ready for testing! Connect your wallet and start using the confidential ETH lending features immediately.

### Quick Start on Live App:
1. **Connect Wallet**: Use MetaMask or any WalletConnect-compatible wallet
2. **Switch to Sepolia**: Ensure you're on Sepolia testnet
3. **Get Test ETH**: Use [Sepolia Faucet](https://sepoliafaucet.com/) for test ETH
4. **Start Lending**: Supply ETH to earn confidential yields

## 🔗 Links

- [Live Application](https://webapp-three-sage.vercel.app/) - Try the protocol now!
- [Zama Documentation](https://docs.zama.ai/)
- [FHEVM Documentation](https://docs.fhevm.org/)
- [WalletConnect](https://walletconnect.com/)
- [Wagmi Documentation](https://wagmi.sh/)