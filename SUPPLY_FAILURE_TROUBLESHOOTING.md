# Supply Failure Troubleshooting Guide

## 🎯 **Your Current Situation**

✅ **Working**: ETH → cWETH swap  
✅ **Working**: Set operator permission  
❌ **Failing**: Supply cWETH to vault  

**Contract Addresses**:
- cWETH: `0x0eEa56B813ca12C96d548905de48Ae4E781d8445`
- Vault: `0x94907A8A739E142f1104E8A0616943252d3571c9`

## 🔍 **Root Cause**

The supply is failing at the **encryption stage** specifically for the vault contract. FHEVM can encrypt for the cWETH contract (swap works) but fails when trying to encrypt for the new vault contract.

## 🛠️ **Step-by-Step Fix**

### **Step 1: Clear Browser Cache**
```bash
# Clear localStorage completely
localStorage.clear()

# Or manually clear FHEVM-related keys
# In browser console, run:
Object.keys(localStorage).forEach(key => {
  if (key.includes('fhevm') || key.includes('encrypt')) {
    localStorage.removeItem(key);
  }
});
```

### **Step 2: Use the Re-initialization Button**
1. Go to your frontend
2. Connect wallet
3. Convert some ETH to cWETH (if not already done)
4. Click "Set Operator" (should work)
5. **Before clicking "Supply"**, click the "🔄 Reinitialize FHEVM (if supply fails)" button
6. Wait for success message
7. Now click "Supply cWETH"

### **Step 3: If Still Failing**
1. Check browser console for specific error messages
2. Look for errors containing "FHE", "encrypt", "vault", or "contract"
3. The error should now be more descriptive

### **Step 4: Alternative Approach**
If the above doesn't work, try this sequence:
1. Clear browser cache completely
2. Hard refresh (Ctrl+Shift+R)
3. Connect wallet
4. Click "🔄 Reinitialize FHEVM" button immediately
5. Try the supply flow

## 🔧 **What I've Fixed**

### **Enhanced Error Detection**
- Better error messages for vault encryption failures
- Automatic detection of FHEVM initialization issues
- More specific error reporting

### **Improved Re-initialization**
- Clears all FHEVM cache (memory + localStorage)
- Logs current contract addresses for debugging
- More thorough cleanup process

### **Manual Re-initialization Button**
- Appears when you have cWETH balance and operator permission
- Allows manual FHEVM re-initialization before supply attempt
- Prevents failed supply attempts

## 📊 **Expected Console Output**

**Successful Re-initialization**:
```
Forcing FHEVM re-initialization for new contracts...
Current contract addresses: {
  cWETH: "0x0eEa56B813ca12C96d548905de48Ae4E781d8445",
  vault: "0x94907A8A739E142f1104E8A0616943252d3571c9"
}
Cleared localStorage encryption cache: [...]
Creating FHE instance using official Zama configuration...
✅ FHE instance created successfully
```

**Successful Supply Flow**:
```
Creating encrypted input for vault: 0x94907A8A739E142f1104E8A0616943252d3571c9 user: 0x...
FHE instance obtained
Added amount to encrypted input
Encrypting input (this may take a moment)...
Input encrypted successfully
Step 3: Calling supply on vault (pull pattern)...
Supply submitted to vault...
```

## 🚨 **If Still Failing**

### **Check These Things**:
1. **Network**: Make sure you're on Sepolia testnet
2. **RPC**: Verify your RPC endpoint is working
3. **Contract**: Confirm vault contract is deployed correctly
4. **Balance**: Ensure you have cWETH balance
5. **Operator**: Verify operator permission is set

### **Debug Commands**:
```javascript
// In browser console, check FHEVM instance
const { getFHEInstance } = await import('./src/utils/fhe.ts');
const fhe = await getFHEInstance();
console.log('FHE instance:', fhe);

// Check contract addresses
console.log('Contract addresses:', {
  cWETH: process.env.NEXT_PUBLIC_CWETH_ADDRESS,
  vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS
});
```

## 🎯 **Expected Result**

After following these steps:
- ✅ Supply should work successfully
- ✅ You should see "Successfully supplied cWETH!" message
- ✅ Transaction should appear on Etherscan
- ✅ Encrypted data should be properly handled

The key is **re-initializing FHEVM specifically for the new vault contract** before attempting the supply operation.
