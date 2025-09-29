const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEBUGGING SUPPLY FUNCTION ===");
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    const cWETHAddress = "0xb66C5359d6bE68df9C0F19f964aa6932De5a5853";
    const vaultAddress = "0x3b7d1A001c963fE8D93892eb3370b083c4bF2007";
    
    const cWETH = await ethers.getContractAt("ConfidentialWETH", cWETHAddress);
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    
    try {
        // Check current state
        console.log("1. Current state:");
        const shares = await vault.getEncryptedShares(deployer.address);
        const totalShares = await vault.getEncryptedTotalShares();
        const totalAssets = await vault.getEncryptedTotalAssets();
        console.log("User shares:", shares);
        console.log("Total shares:", totalShares);
        console.log("Total assets:", totalAssets);
        
        // Check cWETH balance
        const cWETHBalance = await cWETH.getEncryptedBalance(deployer.address);
        console.log("cWETH balance:", cWETHBalance);
        
        // Check if we need to wrap more ETH
        if (cWETHBalance === "0x0000000000000000000000000000000000000000000000000000000000000000") {
            console.log("Wrapping more ETH...");
            const wrapTx = await cWETH.wrap({ value: ethers.parseEther("0.01") });
            await wrapTx.wait();
            console.log("✅ ETH wrapped");
        }
        
        // Check operator
        const isOperator = await cWETH.isOperator(deployer.address, vaultAddress);
        console.log("Is operator:", isOperator);
        
        if (!isOperator) {
            console.log("Setting operator...");
            const setOperatorTx = await cWETH.setOperator(vaultAddress, Math.floor(Date.now() / 1000) + 3600);
            await setOperatorTx.wait();
            console.log("✅ Operator set");
        }
        
        // Try to call supply with a very small amount using dummy data
        // This will fail but might give us insight into what's wrong
        console.log("\n2. Testing supply function...");
        
        // Create minimal dummy data
        const dummyEncryptedAmount = "0x0000000000000000000000000000000000000000000000000000000000000001";
        const dummyProof = "0x0000000000000000000000000000000000000000000000000000000000000001";
        
        try {
            console.log("Attempting supply with dummy data...");
            const tx = await vault.supply(dummyEncryptedAmount, dummyProof, {
                gasLimit: 800000
            });
            console.log("✅ Supply transaction submitted:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("✅ Supply transaction confirmed:", receipt.hash);
            console.log("Gas used:", receipt.gasUsed.toString());
            
            // Check state after supply
            console.log("\n3. State after supply:");
            const sharesAfter = await vault.getEncryptedShares(deployer.address);
            const totalSharesAfter = await vault.getEncryptedTotalShares();
            const totalAssetsAfter = await vault.getEncryptedTotalAssets();
            console.log("User shares after:", sharesAfter);
            console.log("Total shares after:", totalSharesAfter);
            console.log("Total assets after:", totalAssetsAfter);
            
        } catch (supplyError) {
            console.log("❌ Supply failed:", supplyError.message);
            
            if (supplyError.message.includes("execution reverted")) {
                console.log("Transaction reverted. This is expected with dummy data.");
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