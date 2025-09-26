# Confidential Lending Protocol - Deployment Guide

## 🚀 Quick Start

### 1. Prerequisites
- Node.js >= 20
- npm >= 7.0.0
- Sepolia ETH for gas fees
- WalletConnect Project ID
- Sepolia RPC URL (Infura/Alchemy)

### 2. Smart Contract Deployment

#### Setup Environment
```bash
# Copy environment template
cp .env.example .env

# Fill in your values:
# PRIVATE_KEY=your_private_key_here
# INFURA_API_KEY=your_infura_key_here
# ETHERSCAN_API_KEY=your_etherscan_key_here
```

#### Deploy to Sepolia
```bash
# Deploy contracts
npx hardhat deploy --network sepolia

# The deployment will output contract addresses
# Save these for frontend configuration
```

### 3. Frontend Setup

#### Install Dependencies
```bash
# Run the setup script
./setup-frontend.sh

# Or manually:
cd webapp
npm install
cp env.example .env.local
```

#### Configure Environment
Update `webapp/.env.local` with:
```bash
# WalletConnect Project ID (get from https://cloud.walletconnect.com/)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Sepolia RPC URL
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_key

# Contract addresses (from deployment)
NEXT_PUBLIC_CWETH_ADDRESS=0x...
NEXT_PUBLIC_VAULT_ADDRESS=0x...

# Note: Zama Relayer SDK uses SepoliaConfig automatically
# No additional relayer configuration needed!
```

#### Start Development Server
```bash
cd webapp
npm run dev
```

### 4. Production Deployment

#### Deploy Frontend to Vercel
```bash
cd webapp
npm run build
# Deploy to Vercel or your preferred platform
```

## 🔧 Configuration Details

### Smart Contract Configuration
- **Network**: Sepolia testnet
- **Solidity Version**: 0.8.27
- **FHEVM Version**: 0.8.0
- **OpenZeppelin Confidential**: 0.2.0

### Frontend Configuration
- **Framework**: Next.js 14
- **UI Library**: Material-UI
- **Web3**: Wagmi + Viem
- **Wallet**: WalletConnect
- **FHE**: Zama Relayer SDK

## 📊 Contract Addresses

After deployment, you'll get addresses like:
- **ConfidentialWETH**: `0x...`
- **ConfidentialLendingVault**: `0x...`

## 🧪 Testing

### Local Testing
```bash
# Run tests (note: FHE operations require Sepolia network)
npm test
```

### Sepolia Testing
```bash
# Test on Sepolia
npm run test:sepolia
```

## 🔐 Security Considerations

1. **Private Keys**: Never commit private keys to version control
2. **Environment Variables**: Use `.env` files and never commit them
3. **FHE Operations**: All sensitive operations are encrypted
4. **Access Control**: Contracts use Ownable pattern for admin functions

## 🚨 Troubleshooting

### Common Issues

1. **Compilation Errors**: Ensure all dependencies are installed
2. **Deployment Failures**: Check gas limits and network connectivity
3. **FHE Errors**: FHE operations require Sepolia network configuration
4. **Frontend Errors**: Verify environment variables are set correctly

### Getting Help

- Check the [Zama Documentation](https://docs.zama.ai/)
- Review [FHEVM Documentation](https://docs.fhevm.org/)
- Check [WalletConnect Documentation](https://walletconnect.com/)

## 📈 Success Metrics

After successful deployment, you should have:
- ✅ Contracts deployed on Sepolia
- ✅ Frontend running locally
- ✅ Wallet connection working
- ✅ ETH supply functionality
- ✅ Encrypted balance tracking
- ✅ Material-UI interface

## 🎯 Next Steps

1. **Phase 2**: Add borrowing functionality
2. **Phase 3**: Implement dynamic interest rates
3. **Phase 4**: Add multi-asset support
4. **Phase 5**: Advanced DeFi features

## 📝 Notes

- This is Phase 1 focusing on supply-only functionality
- All balances and transactions are encrypted using FHE
- The protocol is designed for the Zama Developer Program
- Production deployment requires additional security audits
