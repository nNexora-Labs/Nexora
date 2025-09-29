const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING CURRENT USER SHARES ===");
    
    // Current contract addresses from deployments
    const vaultAddress = "0x3b7d1A001c963fE8D93892eb3370b083c4bF2007";
    const cWETHAddress = "0xb66C5359d6bE68df9C0F19f964aa6932De5a5853";
    
    // The user who made supply transactions
    const userAddress = "0x2077a4F65b683aC9D9D2A0E855aE79B94F3C178a";
    
    console.log("Vault:", vaultAddress);
    console.log("cWETH:", cWETHAddress);
    console.log("User:", userAddress);
    
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    
    try {
        console.log("\n1. Checking user shares:");
        const userShares = await vault.getEncryptedShares(userAddress);
        console.log("User shares:", userShares);
        
        // Check if user shares are all zeros
        const isAllZeros = userShares === "0x0000000000000000000000000000000000000000000000000000000000000000";
        console.log("User shares are all zeros:", isAllZeros);
        
        if (!isAllZeros) {
            console.log("✅ User has shares!");
            
            // Check total shares
            const totalShares = await vault.getEncryptedTotalShares();
            console.log("Total shares:", totalShares);
            
            // Check if total shares equals user shares (100% ownership)
            const sharesMatch = totalShares.toLowerCase() === userShares.toLowerCase();
            console.log("User owns 100% of shares:", sharesMatch);
            
            if (sharesMatch) {
                console.log("✅ Perfect! User owns 100% of the vault shares.");
            }
        } else {
            console.log("❌ User has no shares - this is the problem!");
        }
        
        // Check recent supply events for this user
        console.log("\n2. Checking recent supply events:");
        
        const provider = ethers.provider;
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 2000); // Search last 2000 blocks
        
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
        
        let userSupplyCount = 0;
        for (const log of supplyLogs) {
            if (log.topics[1]) {
                const eventUserAddress = ethers.getAddress("0x" + log.topics[1].slice(-40));
                if (eventUserAddress.toLowerCase() === userAddress.toLowerCase()) {
                    userSupplyCount++;
                    console.log(`Supply ${userSupplyCount}: Block ${log.blockNumber}, Tx: ${log.transactionHash}`);
                }
            }
        }
        
        console.log(`User made ${userSupplyCount} supply transactions`);
        
        if (userSupplyCount > 0 && isAllZeros) {
            console.log("❌ PROBLEM: User made supplies but has no shares!");
            console.log("This indicates a bug in the supply function or event emission.");
        } else if (userSupplyCount > 0 && !isAllZeros) {
            console.log("✅ User has supplies and shares - this is correct!");
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
