const { ethers } = require("hardhat");

async function main() {
    // Replace with the actual transaction hash from your console
    const txHash = "0x36b081546a4dd2fb63d4204ac8af7d9e33eb338beeaad0ef3e0e25af39961308";
    
    console.log("Checking transaction:", txHash);
    
    try {
        const receipt = await ethers.provider.getTransactionReceipt(txHash);
        
        if (receipt) {
            console.log("✅ Transaction found");
            console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
            console.log("Block number:", receipt.blockNumber);
            console.log("Gas used:", receipt.gasUsed.toString());
            console.log("Gas limit:", receipt.gasLimit.toString());
            
            if (receipt.status === 0) {
                console.log("❌ Transaction failed");
                
                // Try to get the transaction to see gas info
                const tx = await ethers.provider.getTransaction(txHash);
                console.log("Gas limit set:", tx.gasLimit.toString());
                console.log("Gas price:", ethers.formatUnits(tx.gasPrice, "gwei"), "gwei");
            }
        } else {
            console.log("❌ Transaction not found or still pending");
            
            // Check if it's pending
            const tx = await ethers.provider.getTransaction(txHash);
            if (tx) {
                console.log("Transaction is pending...");
                console.log("Gas limit:", tx.gasLimit.toString());
                console.log("Gas price:", ethers.formatUnits(tx.gasPrice, "gwei"), "gwei");
            }
        }
        
    } catch (error) {
        console.log("❌ Error checking transaction:", error.message);
    }
    
    console.log("\n=== NEXT STEPS ===");
    console.log("1. Check the transaction on Sepolia Etherscan:");
    console.log(`   https://sepolia.etherscan.io/tx/${txHash}`);
    console.log("2. Look for the 'Error' section to see why it failed");
    console.log("3. Common issues:");
    console.log("   - Out of gas");
    console.log("   - FHEVM coprocessor timeout");
    console.log("   - Contract revert");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
