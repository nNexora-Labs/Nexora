const { ethers } = require("hardhat");

async function quickSwapTest() {
  console.log("🚀 Quick Bidirectional Swap Test");
  console.log("=" .repeat(40));

  // Contract addresses
  const CWETH_ADDRESS = "0x69A14ABEc7B1D0448a1E67C49fC8cEE58cE1cdE3";
  
  // Get signer
  const signers = await ethers.getSigners();
  const user = signers[0];
  console.log("👤 Testing with:", user.address);

  // Connect to contract
  const ConfidentialWETH = await ethers.getContractAt("ConfidentialWETH", CWETH_ADDRESS);
  
  const testAmount = ethers.parseEther("0.01"); // 0.01 ETH for quick test

  try {
    // 1. Check initial ETH balance
    const initialETH = await ethers.provider.getBalance(user.address);
    console.log("💰 Initial ETH:", ethers.formatEther(initialETH), "ETH");

    // 2. Wrap ETH → cWETH
    console.log("\n⏳ Wrapping", ethers.formatEther(testAmount), "ETH...");
    const wrapTx = await ConfidentialWETH.connect(user).wrap({ value: testAmount });
    const wrapReceipt = await wrapTx.wait();
    console.log("✅ Wrap successful!");
    console.log("📋 Transaction hash:", wrapReceipt.hash);
    console.log("⛽ Gas used:", wrapReceipt.gasUsed.toString());

    // 3. Check ETH balance after wrap
    const afterWrapETH = await ethers.provider.getBalance(user.address);
    console.log("💰 ETH after wrap:", ethers.formatEther(afterWrapETH), "ETH");

    // 4. Calculate ETH spent
    const ethSpent = parseFloat(ethers.formatEther(initialETH)) - parseFloat(ethers.formatEther(afterWrapETH));
    console.log("💸 ETH spent (including gas):", ethSpent.toFixed(6), "ETH");

    // 5. Unwrap cWETH → ETH
    console.log("\n⏳ Unwrapping", ethers.formatEther(testAmount), "cWETH...");
    const unwrapTx = await ConfidentialWETH.connect(user).unwrap({ value: testAmount });
    const unwrapReceipt = await unwrapTx.wait();
    console.log("✅ Unwrap successful!");
    console.log("📋 Transaction hash:", unwrapReceipt.hash);
    console.log("⛽ Gas used:", unwrapReceipt.gasUsed.toString());

    // 6. Check final ETH balance
    const finalETH = await ethers.provider.getBalance(user.address);
    console.log("💰 Final ETH:", ethers.formatEther(finalETH), "ETH");

    // 7. Calculate net change
    const netETHChange = parseFloat(ethers.formatEther(finalETH)) - parseFloat(ethers.formatEther(initialETH));
    console.log("\n📊 Net ETH Change:", netETHChange.toFixed(6), "ETH");

    // 8. Calculate total gas cost
    const wrapGasCost = wrapReceipt.gasUsed * wrapReceipt.gasPrice;
    const unwrapGasCost = unwrapReceipt.gasUsed * unwrapReceipt.gasPrice;
    const totalGasCost = wrapGasCost + unwrapGasCost;
    console.log("⛽ Total gas cost:", ethers.formatEther(totalGasCost), "ETH");

    // 9. Verify the flow worked
    console.log("\n🔍 Verification:");
    console.log("  Expected net change: ~", (-parseFloat(ethers.formatEther(totalGasCost))).toFixed(6), "ETH (gas cost)");
    console.log("  Actual net change:", netETHChange.toFixed(6), "ETH");
    
    if (Math.abs(netETHChange + parseFloat(ethers.formatEther(totalGasCost))) < 0.001) {
      console.log("✅ ETH flow verification: PASSED");
    } else {
      console.log("❌ ETH flow verification: FAILED");
    }

    console.log("\n🎉 Quick test completed!");
    console.log("📝 Note: cWETH balances are encrypted and cannot be read directly from the contract.");
    console.log("📝 The frontend will decrypt and display the actual cWETH balance.");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.message.includes("insufficient funds")) {
      console.log("💡 Tip: Make sure you have enough ETH for the test amount + gas fees");
    }
  }
}

quickSwapTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });