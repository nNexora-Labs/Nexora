const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEBUGGING FRONTEND USER SUPPLY ===");
    
    // The actual frontend user who is trying to supply
    const frontendUser = "0x2077a4F65b683aC9D9D2A0E855aE79B94F3C178a";
    
    const vaultAddress = "0x3b7d1A001c963fE8D93892eb3370b083c4bF2007";
    const cWETHAddress = "0xb66C5359d6bE68df9C0F19f964aa6932De5a5853";
    
    console.log("Frontend user:", frontendUser);
    console.log("Vault:", vaultAddress);
    console.log("cWETH:", cWETHAddress);
    
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    const cWETH = await ethers.getContractAt("ConfidentialWETH", cWETHAddress);
    
    try {
        console.log("\n1. Frontend user state:");
        
        // Check user shares
        const userShares = await vault.getEncryptedShares(frontendUser);
        console.log("User shares:", userShares);
        
        // Check total shares
        const totalShares = await vault.getEncryptedTotalShares();
        console.log("Total shares:", totalShares);
        
        // Check if user owns 100% of shares
        const sharesMatch = totalShares.toLowerCase() === userShares.toLowerCase();
        console.log("User owns 100% of shares:", sharesMatch);
        
        // Check operator status
        const isOperator = await cWETH.isOperator(frontendUser, vaultAddress);
        console.log("Is operator:", isOperator);
        
        // Check user's cWETH balance
        const cWETHBalance = await cWETH.getEncryptedBalance(frontendUser);
        console.log("User cWETH balance:", cWETHBalance);
        
        console.log("\n2. Checking recent transactions from frontend user:");
        
        // Get recent blocks
        const provider = ethers.provider;
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 200);
        
        // Get all transactions from the frontend user to the vault
        const logs = await provider.getLogs({
            address: vaultAddress,
            fromBlock,
            toBlock: currentBlock
        });
        
        console.log("Recent vault logs:", logs.length);
        
        let successCount = 0;
        let failureCount = 0;
        
        for (const log of logs) {
            try {
                const tx = await provider.getTransaction(log.transactionHash);
                if (tx.from.toLowerCase() === frontendUser.toLowerCase()) {
                    const receipt = await provider.getTransactionReceipt(log.transactionHash);
                    console.log(`\nTransaction: ${log.transactionHash}`);
                    console.log(`Block: ${log.blockNumber}`);
                    console.log(`Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
                    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
                    console.log(`Gas limit: ${tx.gasLimit.toString()}`);
                    
                    if (receipt.status === 1) {
                        successCount++;
                        console.log("✅ This transaction succeeded");
                    } else {
                        failureCount++;
                        console.log("❌ This transaction failed!");
                        
                        // Try to decode the transaction to see what function was called
                        try {
                            const iface = new ethers.Interface([
                                "function supply(externalEuint64 encryptedAmount, bytes calldata inputProof)"
                            ]);
                            const decoded = iface.parseTransaction({ data: tx.data });
                            console.log("Function called:", decoded.name);
                            console.log("Arguments length:", decoded.args.length);
                        } catch (e) {
                            console.log("Could not decode transaction data");
                            console.log("Raw data length:", tx.data.length);
                        }
                    }
                }
            } catch (e) {
                console.log("Error checking transaction:", e.message);
            }
        }
        
        console.log(`\nSummary: ${successCount} successful, ${failureCount} failed transactions`);
        
        if (failureCount > 0) {
            console.log("\n❌ There are failed supply transactions!");
            console.log("This suggests the supply function is failing on-chain.");
            console.log("Possible causes:");
            console.log("1. Gas limit too low");
            console.log("2. FHE encryption/decryption issues");
            console.log("3. Contract logic errors");
            console.log("4. FHEVM coprocessor issues");
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
