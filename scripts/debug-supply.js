const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEBUGGING SUPPLY TRANSACTION ===");
    
    const cWETHAddress = "0x9E862F71D5Dfe8652e89810db06695dDDB2553B2";
    const vaultAddress = "0x0ffD747aB5BC49F4b740b2Def06496444af7749a";
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    const cWETH = await ethers.getContractAt("ConfidentialWETH", cWETHAddress);
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    
    try {
        // Check if we have cWETH balance
        console.log("\n1. Checking cWETH balance...");
        const encryptedBalance = await cWETH.getEncryptedBalance(deployer.address);
        console.log("Encrypted balance:", encryptedBalance);
        
        // Check if operator is set
        console.log("\n2. Checking operator status...");
        const isOperator = await cWETH.isOperator(deployer.address, vaultAddress);
        console.log("Is operator:", isOperator);
        
        if (!isOperator) {
            console.log("Setting operator...");
            const setOperatorTx = await cWETH.setOperator(vaultAddress, Math.floor(Date.now() / 1000) + 3600);
            await setOperatorTx.wait();
            console.log("✅ Operator set");
        }
        
        // Check vault asset
        console.log("\n3. Checking vault asset...");
        const vaultAsset = await vault.asset();
        console.log("Vault asset:", vaultAsset);
        console.log("Expected cWETH:", cWETHAddress);
        console.log("Match:", vaultAsset.toLowerCase() === cWETHAddress.toLowerCase());
        
        // Check if vault has any TVL
        console.log("\n4. Checking vault state...");
        try {
            const totalAssets = await vault.getEncryptedTotalAssets();
            console.log("Total assets (encrypted):", totalAssets);
        } catch (error) {
            console.log("Could not get total assets:", error.message);
        }
        
        // Try to estimate gas for supply function
        console.log("\n5. Testing supply function call...");
        try {
            // Create a dummy encrypted amount (this is just for testing gas estimation)
            const dummyEncryptedAmount = "0x0000000000000000000000000000000000000000000000000000000000000001";
            const dummyProof = "0x0000000000000000000000000000000000000000000000000000000000000001";
            
            console.log("Attempting gas estimation for supply...");
            const gasEstimate = await vault.supply.estimateGas(dummyEncryptedAmount, dummyProof);
            console.log("✅ Gas estimate successful:", gasEstimate.toString());
            
        } catch (gasError) {
            console.log("❌ Gas estimation failed:", gasError.message);
            
            // Check if it's a revert reason
            if (gasError.message.includes("revert")) {
                console.log("Transaction would revert. Possible reasons:");
                console.log("- Invalid encrypted amount format");
                console.log("- Insufficient cWETH balance");
                console.log("- Operator not set properly");
                console.log("- FHE encryption issues");
            }
        }
        
        // Check network status
        console.log("\n6. Checking network status...");
        const network = await ethers.provider.getNetwork();
        console.log("Network:", network.name, "Chain ID:", network.chainId.toString());
        console.log("Expected: sepolia, Chain ID: 11155111");
        
        // Check recent transactions
        console.log("\n7. Checking recent transactions...");
        const txCount = await ethers.provider.getTransactionCount(deployer.address);
        console.log("Transaction count:", txCount);
        
    } catch (error) {
        console.log("❌ Error during debugging:", error.message);
        console.log("Full error:", error);
    }
    
    console.log("\n=== DEBUGGING COMPLETE ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
