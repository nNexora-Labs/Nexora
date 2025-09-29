const { ethers } = require("hardhat");

async function main() {
    console.log("Testing contract functionality...");
    
    // Get the deployed contracts
    const cWETHAddress = "0x9E862F71D5Dfe8652e89810db06695dDDB2553B2";
    const vaultAddress = "0x0ffD747aB5BC49F4b740b2Def06496444af7749a";
    
    console.log("cWETH Address:", cWETHAddress);
    console.log("Vault Address:", vaultAddress);
    
    // Get the contract instances
    const cWETH = await ethers.getContractAt("ConfidentialWETH", cWETHAddress);
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    
    console.log("Contracts loaded successfully");
    
    // Check if contracts have code
    const cWETHCode = await ethers.provider.getCode(cWETHAddress);
    const vaultCode = await ethers.provider.getCode(vaultAddress);
    
    console.log("cWETH has code:", cWETHCode !== "0x");
    console.log("Vault has code:", vaultCode !== "0x");
    
    if (cWETHCode === "0x") {
        console.log("❌ cWETH contract not deployed properly");
        return;
    }
    
    if (vaultCode === "0x") {
        console.log("❌ Vault contract not deployed properly");
        return;
    }
    
    // Test basic contract calls
    try {
        const cWETHName = await cWETH.name();
        console.log("✅ cWETH name:", cWETHName);
        
        const vaultAsset = await vault.asset();
        console.log("✅ Vault asset:", vaultAsset);
        
        // Check if vault asset matches cWETH address
        if (vaultAsset.toLowerCase() === cWETHAddress.toLowerCase()) {
            console.log("✅ Vault asset matches cWETH address");
        } else {
            console.log("❌ Vault asset mismatch:");
            console.log("  Expected:", cWETHAddress);
            console.log("  Got:", vaultAsset);
        }
        
    } catch (error) {
        console.log("❌ Error calling contract functions:", error.message);
    }
    
    console.log("Test completed");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
