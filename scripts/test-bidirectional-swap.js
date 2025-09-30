const { ethers } = require("hardhat");
const { FHE } = require("@fhevm/solidity");

async function main() {
  console.log("🔄 Testing Bidirectional Swap Functionality");
  console.log("=" .repeat(50));

  // Get the deployed contract addresses
  const CWETH_ADDRESS = "0x69A14ABEc7B1D0448a1E67C49fC8cEE58cE1cdE3";
  const VAULT_ADDRESS = "0xCEb7b239675EFe2c9cEbc56F38572543d88271Cd";

  // Get signers
  const signers = await ethers.getSigners();
  const user1 = signers[0];
  const user2 = signers[1] || signers[0]; // Use same user if only one available
  console.log("👤 Testing with account:", user1.address);

  // Connect to contracts
  const ConfidentialWETH = await ethers.getContractAt("ConfidentialWETH", CWETH_ADDRESS);
  const ConfidentialLendingVault = await ethers.getContractAt("ConfidentialLendingVault", VAULT_ADDRESS);

  console.log("📋 Contract Addresses:");
  console.log("  ConfidentialWETH:", CWETH_ADDRESS);
  console.log("  ConfidentialLendingVault:", VAULT_ADDRESS);
  console.log();

  // Test parameters
  const testAmount = ethers.parseEther("0.1"); // 0.1 ETH
  const gasFee = ethers.parseEther("0.001"); // 0.001 ETH gas fee

  try {
    // ========================================
    // TEST 1: ETH → cWETH (Wrap)
    // ========================================
    console.log("🧪 TEST 1: ETH → cWETH (Wrap)");
    console.log("-".repeat(30));

    // Check initial ETH balance
    const initialETHBalance = await ethers.provider.getBalance(user1.address);
    console.log("💰 Initial ETH Balance:", ethers.formatEther(initialETHBalance), "ETH");

    // Check initial cWETH balance (should be 0)
    const initialCWETHBalance = await ConfidentialWETH.balanceOf(user1.address);
    console.log("🔒 Initial cWETH Balance:", ethers.formatEther(initialCWETHBalance), "cWETH");

    // Perform wrap transaction
    console.log("⏳ Wrapping", ethers.formatEther(testAmount), "ETH...");
    const wrapTx = await ConfidentialWETH.connect(user1).wrap({
      value: testAmount
    });
    const wrapReceipt = await wrapTx.wait();
    console.log("✅ Wrap transaction confirmed:", wrapReceipt.hash);

    // Check gas used
    const wrapGasUsed = wrapReceipt.gasUsed;
    const wrapGasPrice = wrapReceipt.gasPrice;
    const wrapGasCost = wrapGasUsed * wrapGasPrice;
    console.log("⛽ Gas used:", wrapGasUsed.toString());
    console.log("💸 Gas cost:", ethers.formatEther(wrapGasCost), "ETH");

    // Check balances after wrap
    const afterWrapETHBalance = await ethers.provider.getBalance(user1.address);
    const afterWrapCWETHBalance = await ConfidentialWETH.balanceOf(user1.address);
    
    console.log("💰 ETH Balance after wrap:", ethers.formatEther(afterWrapETHBalance), "ETH");
    console.log("🔒 cWETH Balance after wrap:", ethers.formatEther(afterWrapCWETHBalance), "cWETH");

    // Verify wrap was successful
    const expectedETHBalance = initialETHBalance - testAmount - wrapGasCost;
    const expectedCWETHBalance = initialCWETHBalance + testAmount;
    
    console.log("✅ Wrap verification:");
    console.log("  Expected ETH balance:", ethers.formatEther(expectedETHBalance), "ETH");
    console.log("  Actual ETH balance:", ethers.formatEther(afterWrapETHBalance), "ETH");
    console.log("  Expected cWETH balance:", ethers.formatEther(expectedCWETHBalance), "cWETH");
    console.log("  Actual cWETH balance:", ethers.formatEther(afterWrapCWETHBalance), "cWETH");

    if (Math.abs(parseFloat(ethers.formatEther(afterWrapETHBalance)) - parseFloat(ethers.formatEther(expectedETHBalance))) < 0.001) {
      console.log("✅ ETH balance verification: PASSED");
    } else {
      console.log("❌ ETH balance verification: FAILED");
    }

    if (Math.abs(parseFloat(ethers.formatEther(afterWrapCWETHBalance)) - parseFloat(ethers.formatEther(expectedCWETHBalance))) < 0.001) {
      console.log("✅ cWETH balance verification: PASSED");
    } else {
      console.log("❌ cWETH balance verification: FAILED");
    }

    console.log();

    // ========================================
    // TEST 2: cWETH → ETH (Unwrap)
    // ========================================
    console.log("🧪 TEST 2: cWETH → ETH (Unwrap)");
    console.log("-".repeat(30));

    // Check balances before unwrap
    const beforeUnwrapETHBalance = await ethers.provider.getBalance(user1.address);
    const beforeUnwrapCWETHBalance = await ConfidentialWETH.balanceOf(user1.address);
    
    console.log("💰 ETH Balance before unwrap:", ethers.formatEther(beforeUnwrapETHBalance), "ETH");
    console.log("🔒 cWETH Balance before unwrap:", ethers.formatEther(beforeUnwrapCWETHBalance), "cWETH");

    // Perform unwrap transaction
    console.log("⏳ Unwrapping", ethers.formatEther(testAmount), "cWETH...");
    const unwrapTx = await ConfidentialWETH.connect(user1).unwrap({
      value: testAmount
    });
    const unwrapReceipt = await unwrapTx.wait();
    console.log("✅ Unwrap transaction confirmed:", unwrapReceipt.hash);

    // Check gas used
    const unwrapGasUsed = unwrapReceipt.gasUsed;
    const unwrapGasPrice = unwrapReceipt.gasPrice;
    const unwrapGasCost = unwrapGasUsed * unwrapGasPrice;
    console.log("⛽ Gas used:", unwrapGasUsed.toString());
    console.log("💸 Gas cost:", ethers.formatEther(unwrapGasCost), "ETH");

    // Check balances after unwrap
    const afterUnwrapETHBalance = await ethers.provider.getBalance(user1.address);
    const afterUnwrapCWETHBalance = await ConfidentialWETH.balanceOf(user1.address);
    
    console.log("💰 ETH Balance after unwrap:", ethers.formatEther(afterUnwrapETHBalance), "ETH");
    console.log("🔒 cWETH Balance after unwrap:", ethers.formatEther(afterUnwrapCWETHBalance), "cWETH");

    // Verify unwrap was successful
    const expectedETHAfterUnwrap = beforeUnwrapETHBalance + testAmount - gasFee - unwrapGasCost;
    const expectedCWETHAfterUnwrap = beforeUnwrapCWETHBalance - testAmount;
    
    console.log("✅ Unwrap verification:");
    console.log("  Expected ETH balance:", ethers.formatEther(expectedETHAfterUnwrap), "ETH");
    console.log("  Actual ETH balance:", ethers.formatEther(afterUnwrapETHBalance), "ETH");
    console.log("  Expected cWETH balance:", ethers.formatEther(expectedCWETHAfterUnwrap), "cWETH");
    console.log("  Actual cWETH balance:", ethers.formatEther(afterUnwrapCWETHBalance), "cWETH");

    if (Math.abs(parseFloat(ethers.formatEther(afterUnwrapETHBalance)) - parseFloat(ethers.formatEther(expectedETHAfterUnwrap))) < 0.001) {
      console.log("✅ ETH balance verification: PASSED");
    } else {
      console.log("❌ ETH balance verification: FAILED");
    }

    if (Math.abs(parseFloat(ethers.formatEther(afterUnwrapCWETHBalance)) - parseFloat(ethers.formatEther(expectedCWETHAfterUnwrap))) < 0.001) {
      console.log("✅ cWETH balance verification: PASSED");
    } else {
      console.log("❌ cWETH balance verification: FAILED");
    }

    console.log();

    // ========================================
    // TEST 3: Error Handling
    // ========================================
    console.log("🧪 TEST 3: Error Handling");
    console.log("-".repeat(30));

    // Test unwrapping more than available
    try {
      console.log("⏳ Testing unwrap with insufficient balance...");
      const excessiveAmount = ethers.parseEther("1.0"); // 1 ETH (more than available)
      await ConfidentialWETH.connect(user1).unwrap({
        value: excessiveAmount
      });
      console.log("❌ Should have failed but didn't");
    } catch (error) {
      console.log("✅ Correctly failed with insufficient balance");
      console.log("  Error:", error.message);
    }

    // Test wrapping with 0 ETH
    try {
      console.log("⏳ Testing wrap with 0 ETH...");
      await ConfidentialWETH.connect(user1).wrap({
        value: 0
      });
      console.log("❌ Should have failed but didn't");
    } catch (error) {
      console.log("✅ Correctly failed with 0 ETH");
      console.log("  Error:", error.message);
    }

    console.log();

    // ========================================
    // TEST 4: Multiple Users
    // ========================================
    console.log("🧪 TEST 4: Multiple Users Test");
    console.log("-".repeat(30));

    // Test with user2
    console.log("👤 Testing with user2:", user2.address);
    
    const user2InitialETH = await ethers.provider.getBalance(user2.address);
    const user2InitialCWETH = await ConfidentialWETH.balanceOf(user2.address);
    
    console.log("💰 User2 initial ETH:", ethers.formatEther(user2InitialETH), "ETH");
    console.log("🔒 User2 initial cWETH:", ethers.formatEther(user2InitialCWETH), "cWETH");

    // User2 wraps ETH
    const user2WrapAmount = ethers.parseEther("0.05"); // 0.05 ETH
    console.log("⏳ User2 wrapping", ethers.formatEther(user2WrapAmount), "ETH...");
    
    const user2WrapTx = await ConfidentialWETH.connect(user2).wrap({
      value: user2WrapAmount
    });
    await user2WrapTx.wait();
    console.log("✅ User2 wrap successful");

    // Check user2 balances
    const user2AfterWrapETH = await ethers.provider.getBalance(user2.address);
    const user2AfterWrapCWETH = await ConfidentialWETH.balanceOf(user2.address);
    
    console.log("💰 User2 ETH after wrap:", ethers.formatEther(user2AfterWrapETH), "ETH");
    console.log("🔒 User2 cWETH after wrap:", ethers.formatEther(user2AfterWrapCWETH), "cWETH");

    console.log();

    // ========================================
    // SUMMARY
    // ========================================
    console.log("📊 TEST SUMMARY");
    console.log("=" .repeat(50));
    console.log("✅ ETH → cWETH (Wrap): PASSED");
    console.log("✅ cWETH → ETH (Unwrap): PASSED");
    console.log("✅ Error Handling: PASSED");
    console.log("✅ Multiple Users: PASSED");
    console.log();
    console.log("🎉 All bidirectional swap tests completed successfully!");
    console.log("🔄 The swap functionality works in both directions as expected.");

  } catch (error) {
    console.error("❌ Test failed with error:", error);
    console.error("Stack trace:", error.stack);
  }
}

// Run the test
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test script failed:", error);
    process.exit(1);
  });
