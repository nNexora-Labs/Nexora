# Confidential Lending Protocol

A fully end-to-end encrypted lending protocol using Zama fhevm that focuses on ETH supply functionality. This is Phase 1 of a larger confidential DeFi protocol built for the Zama Developer Program.

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
cp .env.example .env
# Fill in your PRIVATE_KEY, INFURA_API_KEY, and ETHERSCAN_API_KEY
```

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
# Fill in your WalletConnect Project ID, RPC URL, and contract addresses
# Note: Zama Relayer SDK uses SepoliaConfig automatically - no additional config needed
```

4. Run development server:
```bash
npm run dev
```

## 🔐 Security Features

- **FHE Proofs**: All encrypted inputs require proper FHE proofs via `FHE.asEuint(input, proof)`
- **Access Control**: Ownable pattern for administrative functions
- **Reentrancy Protection**: ReentrancyGuard for supply/withdraw functions
- **Safe Math**: OpenZeppelin's SafeERC20 for token operations
- **Input Validation**: Proper checks for insufficient balances and invalid proofs

## 📊 Key Metrics

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

## 🎯 Phase 1 Success Metrics

- ✅ User can connect wallet
- ✅ User can see ETH balance
- ✅ User can supply ETH (converted to cWETH)
- ✅ Supply is properly encrypted and recorded
- ✅ Frontend displays encrypted balance information

## 🔮 Future Phases

- ** Borrowing functionality
- ** Dynamic interest rates
- ** Multi-asset support
- ** Advanced DeFi features

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

This project is built for the Zama Developer Program. Contributions and feedback are welcome!

## 🔗 Links

- [Zama Documentation](https://docs.zama.ai/)
- [WalletConnect](https://walletconnect.com/)
- [Wagmi Documentation](https://wagmi.sh/)