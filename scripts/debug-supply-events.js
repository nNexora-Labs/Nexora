const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEBUGGING SUPPLY EVENTS ===");
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    const vaultAddress = "0x3b7d1A001c963fE8D93892eb3370b083c4bF2007";
    
    try {
        // Get recent blocks
        const provider = ethers.provider;
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000);
        
        console.log("Searching blocks:", fromBlock, "to", currentBlock);
        
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
            console.log("\nSupply Event Details:");
            console.log("Block:", log.blockNumber);
            console.log("Tx Hash:", log.transactionHash);
            console.log("Topics:", log.topics);
            console.log("Data:", log.data);
            
            if (log.topics[1]) {
                // The topic should be the user address, but it might be padded
                const rawTopic = log.topics[1];
                console.log("Raw topic:", rawTopic);
                
                // Try to extract the address from the topic
                // Topics are 32 bytes, addresses are 20 bytes, so the address is in the last 20 bytes
                try {
                    const userAddress = ethers.getAddress("0x" + rawTopic.slice(-40));
                    console.log("Extracted user address:", userAddress);
                    console.log("Matches deployer:", userAddress.toLowerCase() === deployer.address.toLowerCase());
                } catch (e) {
                    console.log("Error parsing address:", e.message);
                }
            }
            
            // Get the transaction details
            try {
                const tx = await provider.getTransaction(log.transactionHash);
                console.log("Transaction from:", tx.from);
                console.log("Transaction to:", tx.to);
                console.log("Transaction value:", tx.value.toString());
            } catch (e) {
                console.log("Error getting transaction:", e.message);
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
