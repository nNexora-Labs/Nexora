const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING SUPPLY FUNCTION DIRECTLY ===");
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    const cWETHAddress = "0x9E862F71D5Dfe8652e89810db06695dDDB2553B2";
    const vaultAddress = "0x0ffD747aB5BC49F4b740b2Def06496444af7749a";
    
    const cWETH = await ethers.getContractAt("ConfidentialWETH", cWETHAddress);
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    
    try {
        // Check if we have cWETH balance
        console.log("1. Checking cWETH balance...");
        const balance = await cWETH.getEncryptedBalance(deployer.address);
        console.log("Encrypted balance:", balance);
        
        if (balance === "0x0000000000000000000000000000000000000000000000000000000000000000") {
            console.log("No cWETH balance, wrapping some ETH...");
            const wrapTx = await cWETH.wrap({ value: ethers.parseEther("0.01") });
            await wrapTx.wait();
            console.log("✅ ETH wrapped");
        }
        
        // Check operator status
        console.log("2. Checking operator status...");
        const isOperator = await cWETH.isOperator(deployer.address, vaultAddress);
        console.log("Is operator:", isOperator);
        
        if (!isOperator) {
            console.log("Setting operator...");
            const setOperatorTx = await cWETH.setOperator(vaultAddress, Math.floor(Date.now() / 1000) + 3600);
            await setOperatorTx.wait();
            console.log("✅ Operator set");
        }
        
        // Try to call supply with dummy data to see the exact error
        console.log("3. Testing supply function with dummy data...");
        
        // Create dummy encrypted data (this will fail but show us the exact error)
        const dummyEncryptedAmount = "0x0000000000000000000000000000000000000000000000000000000000000001";
        const dummyProof = "0x0000000000000000000000000000000000000000000000000000000000000001";
        
        try {
            // Try to estimate gas first
            console.log("Estimating gas for supply...");
            const gasEstimate = await vault.supply.estimateGas(dummyEncryptedAmount, dummyProof);
            console.log("Gas estimate:", gasEstimate.toString());
            
            // Try to call supply
            console.log("Calling supply with dummy data...");
            const tx = await vault.supply(dummyEncryptedAmount, dummyProof, {
                gasLimit: 800000
            });
            console.log("✅ Supply transaction submitted:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("✅ Supply transaction confirmed:", receipt.hash);
            
        } catch (supplyError) {
            console.log("❌ Supply failed:", supplyError.message);
            
            // Check if it's a revert with reason
            if (supplyError.message.includes("execution reverted")) {
                console.log("Transaction reverted. Possible reasons:");
                console.log("1. Invalid encrypted amount format");
                console.log("2. FHEVM coprocessor not available");
                console.log("3. Contract logic error");
                console.log("4. Insufficient cWETH balance");
            }
            
            // Try to decode the revert reason if available
            if (supplyError.data) {
                console.log("Revert data:", supplyError.data);
            }
        }
        
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
