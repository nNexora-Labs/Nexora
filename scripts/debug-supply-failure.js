const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEBUGGING SUPPLY FAILURE ===");
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    const vaultAddress = "0x3b7d1A001c963fE8D93892eb3370b083c4bF2007";
    const cWETHAddress = "0xb66C5359d6bE68df9C0F19f964aa6932De5a5853";
    
    const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
    const cWETH = await ethers.getContractAt("ConfidentialWETH", cWETHAddress);
    
    try {
        console.log("\n1. Current state:");
        
        // Check user shares before
        const sharesBefore = await vault.getEncryptedShares(deployer.address);
        console.log("User shares before:", sharesBefore);
        
        // Check total shares before
        const totalSharesBefore = await vault.getEncryptedTotalShares();
        console.log("Total shares before:", totalSharesBefore);
        
        // Check total assets before
        const totalAssetsBefore = await vault.getEncryptedTotalAssets();
        console.log("Total assets before:", totalAssetsBefore);
        
        // Check operator status
        const isOperator = await cWETH.isOperator(deployer.address, vaultAddress);
        console.log("Is operator:", isOperator);
        
        // Check user's cWETH balance
        const cWETHBalance = await cWETH.getEncryptedBalance(deployer.address);
        console.log("User cWETH balance:", cWETHBalance);
        
        // Check vault's cWETH balance
        const vaultCWETHBalance = await cWETH.getEncryptedBalance(vaultAddress);
        console.log("Vault cWETH balance:", vaultCWETHBalance);
        
        console.log("\n2. Checking recent failed transactions:");
        
        // Get recent blocks
        const provider = ethers.provider;
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 100);
        
        // Get all transactions from the user to the vault in recent blocks
        const logs = await provider.getLogs({
            address: vaultAddress,
            fromBlock,
            toBlock: currentBlock
        });
        
        console.log("Recent vault logs:", logs.length);
        
        // Check for any failed transactions
        for (const log of logs) {
            try {
                const tx = await provider.getTransaction(log.transactionHash);
                if (tx.from.toLowerCase() === deployer.address.toLowerCase()) {
                    const receipt = await provider.getTransactionReceipt(log.transactionHash);
                    console.log(`\nTransaction: ${log.transactionHash}`);
                    console.log(`Block: ${log.blockNumber}`);
                    console.log(`Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
                    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
                    
                    if (receipt.status === 0) {
                        console.log("❌ This transaction failed!");
                        
                        // Try to decode the transaction to see what function was called
                        try {
                            const iface = new ethers.Interface([
                                "function supply(externalEuint64 encryptedAmount, bytes calldata inputProof)"
                            ]);
                            const decoded = iface.parseTransaction({ data: tx.data });
                            console.log("Function called:", decoded.name);
                            console.log("Arguments:", decoded.args);
                        } catch (e) {
                            console.log("Could not decode transaction data");
                        }
                    }
                }
            } catch (e) {
                console.log("Error checking transaction:", e.message);
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
