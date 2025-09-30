const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Comprehensive Withdraw Analysis Debug...");

    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);

    // Use the addresses from your debug script
    const VAULT_ADDRESS = "0x3AA097C5D1e046510577f8BF61946A6C79DE1740";
    const CWETH_ADDRESS = "0xDcd0F75fdBBb999f56855D49155c381887afC1Af";

    const vault = await ethers.getContractAt("ConfidentialLendingVault", VAULT_ADDRESS);
    const cWETH = await ethers.getContractAt("ConfidentialWETH", CWETH_ADDRESS);

    try {
        console.log("\n=== WITHDRAW FUNCTION ANALYSIS ===\n");

        // 1. Check current state before any operations
        console.log("1. Initial State Check:");
        const userSharesBefore = await vault.getEncryptedShares(deployer.address);
        const totalSharesBefore = await vault.getEncryptedTotalShares();
        const totalAssetsBefore = await vault.getEncryptedTotalAssets();
        const userCWETHBalance = await cWETH.getEncryptedBalance(deployer.address);
        const vaultCWETHBalance = await cWETH.getEncryptedBalance(VAULT_ADDRESS);

        console.log("User shares:", userSharesBefore);
        console.log("Total shares:", totalSharesBefore);
        console.log("Total assets:", totalAssetsBefore);
        console.log("User cWETH balance:", userCWETHBalance);
        console.log("Vault cWETH balance:", vaultCWETHBalance);

        // 2. Check operator permissions
        console.log("\n2. Operator Permissions Check:");
        const isUserOperator = await cWETH.isOperator(deployer.address, VAULT_ADDRESS);
        const isVaultOperator = await cWETH.isOperator(VAULT_ADDRESS, VAULT_ADDRESS);
        console.log("Is vault operator for user:", isUserOperator);
        console.log("Is vault operator for itself:", isVaultOperator);

        // 3. Test withdraw with minimal amount to see specific error
        console.log("\n3. Testing withdraw with minimal encrypted data...");

        try {
            // Try withdraw with zero amount first to see behavior
            const tx = await vault.connect(deployer).withdraw(
                "0x0000000000000000000000000000000000000000000000000000000000000000",
                "0x"
            );

            console.log("Withdraw transaction hash:", tx.hash);
            const receipt = await tx.wait();
            console.log("Withdraw transaction receipt:", {
                status: receipt.status,
                gasUsed: receipt.gasUsed.toString(),
                blockNumber: receipt.blockNumber,
                logs: receipt.logs.length
            });

            if (receipt.status === 1) {
                console.log("✅ Withdraw successful");
            } else {
                console.log("❌ Withdraw failed");
            }

        } catch (error) {
            console.log("❌ Withdraw error:", error.message);

            // Try to get more specific error information
            if (error.message.includes("execution reverted")) {
                console.log("🔍 Transaction reverted - analyzing revert reason...");

                try {
                    // Try callStatic to get the revert reason
                    await vault.connect(deployer).callStatic.withdraw(
                        "0x0000000000000000000000000000000000000000000000000000000000000000",
                        "0x"
                    );
                } catch (callError) {
                    console.log("Call static revert reason:", callError.message);
                }
            }
        }

        // 4. Check state after failed withdraw attempt
        console.log("\n4. State After Withdraw Attempt:");
        const userSharesAfter = await vault.getEncryptedShares(deployer.address);
        const totalSharesAfter = await vault.getEncryptedTotalShares();
        const totalAssetsAfter = await vault.getEncryptedTotalAssets();
        const userCWETHBalanceAfter = await cWETH.getEncryptedBalance(deployer.address);
        const vaultCWETHBalanceAfter = await cWETH.getEncryptedBalance(VAULT_ADDRESS);

        console.log("User shares:", userSharesAfter);
        console.log("Total shares:", totalSharesAfter);
        console.log("Total assets:", totalAssetsAfter);
        console.log("User cWETH balance:", userCWETHBalanceAfter);
        console.log("Vault cWETH balance:", vaultCWETHBalanceAfter);

        // 5. Analyze the withdraw function logic
        console.log("\n5. Withdraw Function Logic Analysis:");

        // Check if user has any shares at all
        const hasUserShares = await vault.getEncryptedShares(deployer.address);
        console.log("User has shares (encrypted):", hasUserShares);

        // Check if the issue is with the confidentialTransferFrom call
        console.log("\n6. Testing confidentialTransferFrom separately:");

        try {
            // Test if the vault can transfer tokens to itself (should work)
            const testTransfer = await cWETH.confidentialTransferFrom(
                VAULT_ADDRESS,
                deployer.address,
                "0x0000000000000000000000000000000000000000000000000000000000000000"
            );
            console.log("Test transfer result:", testTransfer);
        } catch (error) {
            console.log("❌ Test transfer failed:", error.message);
        }

        // 7. Check for recent withdraw events
        console.log("\n7. Recent Withdraw Events:");
        const currentBlock = await ethers.provider.getBlockNumber();
        const withdrawFilter = vault.filters.ConfidentialWithdraw();
        const withdrawEvents = await vault.queryFilter(withdrawFilter, Math.max(0, currentBlock - 1000), currentBlock);

        console.log("Withdraw events in last 1000 blocks:", withdrawEvents.length);

        for (let i = 0; i < Math.min(withdrawEvents.length, 5); i++) {
            const event = withdrawEvents[i];
            console.log(`Withdraw event ${i + 1}:`, {
                user: event.args.user,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash
            });
        }

        // 8. Check for failed transactions
        console.log("\n8. Recent Failed Transactions:");
        for (let i = 0; i < 20; i++) {
            try {
                const blockNumber = currentBlock - i;
                const block = await ethers.provider.getBlock(blockNumber, true);

                if (block && block.transactions) {
                    for (const txHash of block.transactions) {
                        try {
                            const receipt = await ethers.provider.getTransactionReceipt(txHash);
                            if (receipt &&
                                receipt.from.toLowerCase() === deployer.address.toLowerCase() &&
                                receipt.status === 0 &&
                                receipt.to.toLowerCase() === VAULT_ADDRESS.toLowerCase()) {

                                console.log("🚨 Failed vault transaction found:", {
                                    hash: receipt.transactionHash,
                                    blockNumber: receipt.blockNumber,
                                    gasUsed: receipt.gasUsed.toString(),
                                    logs: receipt.logs.length
                                });

                                // Try to decode the transaction
                                const tx = await ethers.provider.getTransaction(txHash);
                                if (tx && tx.data) {
                                    console.log("Transaction data (first 50 chars):", tx.data.substring(0, 50));
                                }
                            }
                        } catch (e) {
                            // Ignore individual tx errors
                        }
                    }
                }
            } catch (e) {
                // Ignore block errors
            }
        }

    } catch (error) {
        console.log("❌ Script error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });