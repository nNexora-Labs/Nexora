const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING SHARE CALCULATION ===");
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    const cWETHAddress = "0xb66C5359d6bE68df9C0F19f964aa6932De5a5853";
    const vaultAddress = "0x3b7d1A001c963fE8D93892eb3370b083c4bF2007";
    
    const cWETH = await ethers.getContractAt("ConfidentialWETH", cWETHAddress);
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    
    try {
        console.log("1. Current vault state:");
        const totalShares = await vault.getEncryptedTotalShares();
        const totalAssets = await vault.getEncryptedTotalAssets();
        console.log("Total shares:", totalShares);
        console.log("Total assets:", totalAssets);
        
        console.log("\n2. User shares:");
        const userShares = await vault.getEncryptedShares(deployer.address);
        console.log("User shares:", userShares);
        
        // Check if user shares are all zeros
        const isAllZeros = userShares === "0x0000000000000000000000000000000000000000000000000000000000000000";
        console.log("User shares are all zeros:", isAllZeros);
        
        if (!isAllZeros) {
            console.log("✅ User has shares - this is correct!");
            
            // Check if total shares equals user shares (100% ownership)
            const sharesMatch = totalShares.toLowerCase() === userShares.toLowerCase();
            console.log("User owns 100% of shares:", sharesMatch);
            
            if (sharesMatch) {
                console.log("✅ Perfect! User owns 100% of the vault shares.");
            } else {
                console.log("❌ Issue: User shares don't match total shares");
                console.log("This suggests either:");
                console.log("1. Multiple users have supplied");
                console.log("2. There's a bug in the share calculation");
                console.log("3. The user supplied from a different address");
            }
        } else {
            console.log("❌ User has no shares - this is the problem!");
            console.log("This means the supply transaction didn't update the user's shares properly.");
            
            // Let's check if there are any supply events
            console.log("\n3. Checking for supply events...");
            
            // Get recent blocks
            const provider = ethers.provider;
            const currentBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 1000);
            
            // Get ConfidentialSupply events
            const supplyFilter = {
                address: vaultAddress,
                topics: [
                    ethers.id("ConfidentialSupply(address)") // event signature
                ]
            };
            
            const supplyLogs = await provider.getLogs({
                ...supplyFilter,
                fromBlock,
                toBlock: currentBlock
            });
            
            console.log("Found supply events:", supplyLogs.length);
            
            for (const log of supplyLogs) {
                if (log.topics[1]) {
                    const userAddress = ethers.getAddress(log.topics[1]);
                    console.log(`Supply event for user: ${userAddress}`);
                    console.log(`Block: ${log.blockNumber}, Tx: ${log.transactionHash}`);
                    
                    if (userAddress.toLowerCase() === deployer.address.toLowerCase()) {
                        console.log("✅ Found supply event for this user!");
                    }
                }
            }
        }
        
        // Check cWETH balance
        console.log("\n4. User cWETH balance:");
        const cWETHBalance = await cWETH.getEncryptedBalance(deployer.address);
        console.log("cWETH balance:", cWETHBalance);
        
        // Check operator status
        console.log("\n5. Operator status:");
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
