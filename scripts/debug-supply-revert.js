const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEBUGGING SUPPLY REVERT ===");
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    // Test the failing contract
    const cWETHAddress = "0x0ffD747aB5BC49F4b740b2Def06496444af7749a"; // This is the VAULT address from your error
    const vaultAddress = "0x0ffD747aB5BC49F4b740b2Def06496444af7749a"; // Wait, this is wrong!
    
    console.log("❌ ERROR DETECTED!");
    console.log("The transaction was sent to the VAULT address, not the cWETH address!");
    console.log("This means the frontend is calling the wrong contract!");
    
    // Let me check the actual addresses
    const correctCWETH = "0x9E862F71D5Dfe8652e89810db06695dDDB2553B2";
    const correctVault = "0x0ffD747aB5BC49F4b740b2Def06496444af7749a";
    
    console.log("\nCorrect addresses should be:");
    console.log("cWETH:", correctCWETH);
    console.log("Vault:", correctVault);
    
    console.log("\nBut the transaction was sent to:", cWETHAddress);
    console.log("This is the VAULT address, not the cWETH address!");
    
    // Check what contract is at the vault address
    const vault = await ethers.getContractAt("ConfidentialLendingVault", correctVault);
    const cWETH = await ethers.getContractAt("ConfidentialWETH", correctCWETH);
    
    try {
        console.log("\n=== CONTRACT VERIFICATION ===");
        console.log("Vault name:", await vault.asset());
        console.log("cWETH name:", await cWETH.name());
        
        // Check if the vault has the supply function
        console.log("Vault has supply function:", typeof vault.supply === 'function');
        
        // Check if the vault asset matches cWETH
        const vaultAsset = await vault.asset();
        console.log("Vault asset:", vaultAsset);
        console.log("Expected cWETH:", correctCWETH);
        console.log("Match:", vaultAsset.toLowerCase() === correctCWETH.toLowerCase());
        
    } catch (error) {
        console.log("❌ Contract verification failed:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
