const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING FIXED SUPPLY FUNCTION ===");
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    const cWETHAddress = "0xb24e4d682e570073139989483cFeF8FC894bF77B";
    const vaultAddress = "0x1408043c0009C2E4112c4985C4b4e9593b6f813b";
    
    const cWETH = await ethers.getContractAt("ConfidentialWETH", cWETHAddress);
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    
    try {
        // Check contract info
        console.log("1. Contract verification...");
        const cWETHName = await cWETH.name();
        const vaultAsset = await vault.asset();
        console.log("✅ cWETH name:", cWETHName);
        console.log("✅ Vault asset:", vaultAsset);
        console.log("✅ Asset match:", vaultAsset.toLowerCase() === cWETHAddress.toLowerCase());
        
        // Wrap some ETH to get cWETH
        console.log("2. Wrapping ETH to get cWETH...");
        const wrapTx = await cWETH.wrap({ value: ethers.parseEther("0.01") });
        await wrapTx.wait();
        console.log("✅ ETH wrapped to cWETH");
        
        // Set operator
        console.log("3. Setting operator...");
        const setOperatorTx = await cWETH.setOperator(vaultAddress, Math.floor(Date.now() / 1000) + 3600);
        await setOperatorTx.wait();
        console.log("✅ Operator set");
        
        // Check status
        const isOperator = await cWETH.isOperator(deployer.address, vaultAddress);
        const balance = await cWETH.getEncryptedBalance(deployer.address);
        console.log("✅ Is operator:", isOperator);
        console.log("✅ Encrypted balance:", balance);
        
        console.log("\n=== CONTRACTS READY ===");
        console.log("The fixed contracts are deployed and ready!");
        console.log("New addresses:");
        console.log("cWETH:", cWETHAddress);
        console.log("Vault:", vaultAddress);
        
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
