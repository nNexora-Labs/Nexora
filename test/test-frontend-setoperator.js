const { ethers } = require("hardhat");

async function main() {
  console.log("Testing frontend-style setOperator call...");
  
  // Get the deployed contracts
  const cwethAddress = "0x0eEa56B813ca12C96d548905de48Ae4E781d8445";
  const vaultAddress = "0x8c27b96D2cb4F0cCE006c4bc75D5A360b567532E";
  
  // Get the contract instances
  const cweth = await ethers.getContractAt("ConfidentialWETH", cwethAddress);
  
  // Get a test account
  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  
  // Simulate frontend call with exact same parameters
  const until = BigInt(Math.floor(Date.now() / 1000) + 3600);
  console.log("Frontend-style parameters:", {
    address: cwethAddress,
    vaultAddress: vaultAddress,
    until: until.toString(),
    untilType: typeof until
  });
  
  // Check current operator status
  const isOperatorBefore = await cweth.isOperator(deployer.address, vaultAddress);
  console.log("Is vault operator before:", isOperatorBefore);
  
  try {
    // Call setOperator with exact same parameters as frontend
    const setOperatorTx = await cweth.setOperator(vaultAddress, until);
    console.log("Set operator transaction:", setOperatorTx.hash);
    
    // Wait for confirmation
    const receipt = await setOperatorTx.wait();
    console.log("Transaction confirmed:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    
    if (receipt.status === 0) {
      console.log("Transaction failed - checking for revert reason...");
      // Try to get the revert reason
      try {
        await cweth.setOperator.staticCall(vaultAddress, until);
      } catch (staticError) {
        console.log("Static call error (revert reason):", staticError.message);
      }
    }
    
    // Check operator status after
    const isOperatorAfter = await cweth.isOperator(deployer.address, vaultAddress);
    console.log("Is vault operator after:", isOperatorAfter);
    
  } catch (error) {
    console.log("Error setting operator:", error.message);
    console.log("Error details:", error);
    
    // Check if it's a gas estimation error
    if (error.message.includes("gas")) {
      console.log("Gas estimation error detected");
    }
    
    // Check if it's a revert error
    if (error.message.includes("revert")) {
      console.log("Transaction reverted");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
