const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING POSITION DATA ===");
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    const cWETHAddress = "0xb66C5359d6bE68df9C0F19f964aa6932De5a5853";
    const vaultAddress = "0x3b7d1A001c963fE8D93892eb3370b083c4bF2007";
    
    const cWETH = await ethers.getContractAt("ConfidentialWETH", cWETHAddress);
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    
    try {
        // Check if user has supplied balance
        console.log("1. Checking supplied balance...");
        const encryptedShares = await vault.getEncryptedShares(deployer.address);
        console.log("Encrypted shares:", encryptedShares);
        
        // Check if shares are initialized (not all zeros)
        const isAllZeros = encryptedShares === "0x0000000000000000000000000000000000000000000000000000000000000000";
        console.log("Is all zeros (no position):", isAllZeros);
        
        if (!isAllZeros) {
            console.log("✅ User has supplied balance!");
            
            // Check total shares
            const totalShares = await vault.getEncryptedTotalShares();
            console.log("Total shares:", totalShares);
            
            // Check total assets
            const totalAssets = await vault.getEncryptedTotalAssets();
            console.log("Total assets:", totalAssets);
            
        } else {
            console.log("❌ User has no supplied balance");
            console.log("This means either:");
            console.log("1. No supply transaction was made");
            console.log("2. Supply transaction failed");
            console.log("3. Contract state is not being updated properly");
        }
        
        // Check if user has cWETH balance
        console.log("\n2. Checking cWETH balance...");
        const cWETHBalance = await cWETH.getEncryptedBalance(deployer.address);
        console.log("cWETH balance:", cWETHBalance);
        
        // Check operator status
        console.log("\n3. Checking operator status...");
        const isOperator = await cWETH.isOperator(deployer.address, vaultAddress);
        console.log("Is operator:", isOperator);
        
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
