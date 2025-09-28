# Local Development Setup for FHEVM

## 🎯 **Why Local Development?**

Since Sepolia FHEVM is experiencing coprocessor downtime, local development is the most reliable way to:
- ✅ **Deploy new contracts** with withdraw/repay/borrow functionality
- ✅ **Test FHEVM features** without network issues
- ✅ **Develop and iterate** quickly
- ✅ **Avoid coprocessor downtime**

## 🛠️ **Setup Steps**

### **Step 1: Start Local Hardhat Node**
```bash
# Kill any existing hardhat processes
pkill -f "hardhat node" || true

# Start local node with Sepolia fork
npx hardhat node --fork https://sepolia.infura.io/v3/edae100994ea476180577c9218370251 --port 8545
```

### **Step 2: Deploy Contracts Locally**
```bash
# In a new terminal
npx hardhat deploy --network localhost
```

### **Step 3: Update Frontend Configuration**
```bash
# In webapp/.env.local
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_CWETH_ADDRESS=<LOCAL_CWETH_ADDRESS>
NEXT_PUBLIC_VAULT_ADDRESS=<LOCAL_VAULT_ADDRESS>
```

### **Step 4: Start Frontend**
```bash
cd webapp
npm run dev
```

## 🔧 **Local Network Benefits**

1. **Reliable FHEVM**: Local FHEVM precompiles work consistently
2. **Fast Iteration**: No network delays or gas costs
3. **Full Control**: Can reset state, fork from any block
4. **Debugging**: Better error messages and debugging tools

## 📋 **Development Workflow**

1. **Develop Features**: Add withdraw/repay/borrow functionality
2. **Test Locally**: Use local network for testing
3. **Deploy to Sepolia**: When FHEVM is stable, deploy to Sepolia
4. **Update Frontend**: Switch frontend to Sepolia addresses

## 🚀 **Next Steps**

1. Set up local development environment
2. Deploy your enhanced contracts locally
3. Test withdraw/repay/borrow functionality
4. Wait for Sepolia FHEVM to stabilize
5. Deploy to Sepolia when ready

This approach lets you continue development while avoiding the current Sepolia issues!
