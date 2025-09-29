const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING CHALLENGE: NEW CONTRACT ADDRESSES ===");
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    const cWETHAddress = "0xb66C5359d6bE68df9C0F19f964aa6932De5a5853";
    const vaultAddress = "0x3b7d1A001c963fE8D93892eb3370b083c4bF2007";
    
    console.log("New contract addresses:");
    console.log("cWETH:", cWETHAddress);
    console.log("Vault:", vaultAddress);
    
    const cWETH = await ethers.getContractAt("ConfidentialWETH", cWETHAddress);
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    
    try {
        // Test basic contract functionality
        console.log("\n1. Contract verification...");
        const cWETHName = await cWETH.name();
        const vaultAsset = await vault.asset();
        console.log("✅ cWETH name:", cWETHName);
        console.log("✅ Vault asset:", vaultAsset);
        console.log("✅ Asset match:", vaultAsset.toLowerCase() === cWETHAddress.toLowerCase());
        
        // Wrap some ETH to get cWETH
        console.log("\n2. Wrapping ETH to get cWETH...");
        const wrapTx = await cWETH.wrap({ value: ethers.parseEther("0.01") });
        await wrapTx.wait();
        console.log("✅ ETH wrapped to cWETH");
        
        // Set operator
        console.log("\n3. Setting operator...");
        const setOperatorTx = await cWETH.setOperator(vaultAddress, Math.floor(Date.now() / 1000) + 3600);
        await setOperatorTx.wait();
        console.log("✅ Operator set");
        
        // Check status
        const isOperator = await cWETH.isOperator(deployer.address, vaultAddress);
        const balance = await cWETH.getEncryptedBalance(deployer.address);
        console.log("✅ Is operator:", isOperator);
        console.log("✅ Encrypted balance:", balance);
        
        console.log("\n=== CHALLENGE CONTRACTS READY ===");
        console.log("✅ New contracts deployed successfully");
        console.log("✅ Basic functionality working");
        console.log("✅ Ready for frontend testing");
        
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Frontend should be updated with new addresses");
        console.log("2. Test supply functionality in the UI");
        console.log("3. This will prove the fix is robust and not address-dependent");
        
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
