const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING CORRECT USER ===");
    
    // The actual user who made the supply transaction
    const actualUser = "0x2077a4F65b683aC9D9D2A0E855aE79B94F3C178a";
    console.log("Actual user who supplied:", actualUser);
    
    const vaultAddress = "0x3b7d1A001c963fE8D93892eb3370b083c4bF2007";
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    
    try {
        console.log("\n1. Vault state:");
        const totalShares = await vault.getEncryptedTotalShares();
        const totalAssets = await vault.getEncryptedTotalAssets();
        console.log("Total shares:", totalShares);
        console.log("Total assets:", totalAssets);
        
        console.log("\n2. Actual user shares:");
        const userShares = await vault.getEncryptedShares(actualUser);
        console.log("User shares:", userShares);
        
        // Check if user shares are all zeros
        const isAllZeros = userShares === "0x0000000000000000000000000000000000000000000000000000000000000000";
        console.log("User shares are all zeros:", isAllZeros);
        
        if (!isAllZeros) {
            console.log("✅ User has shares!");
            
            // Check if total shares equals user shares (100% ownership)
            const sharesMatch = totalShares.toLowerCase() === userShares.toLowerCase();
            console.log("User owns 100% of shares:", sharesMatch);
            
            if (sharesMatch) {
                console.log("✅ Perfect! User owns 100% of the vault shares.");
            } else {
                console.log("❌ Issue: User shares don't match total shares");
                console.log("This suggests multiple users have supplied or there's a bug.");
            }
        } else {
            console.log("❌ User has no shares - this is the real problem!");
            console.log("The supply transaction succeeded but didn't update the user's shares.");
            console.log("This indicates a bug in the supply function logic.");
        }
        
        // Also check the deployer account for comparison
        const [deployer] = await ethers.getSigners();
        console.log("\n3. Deployer account shares:");
        console.log("Deployer address:", deployer.address);
        const deployerShares = await vault.getEncryptedShares(deployer.address);
        console.log("Deployer shares:", deployerShares);
        
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
