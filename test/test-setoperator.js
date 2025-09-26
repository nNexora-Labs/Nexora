const { ethers } = require("hardhat");

async function main() {
  console.log("Testing setOperator function...");
  
  // Get the deployed contracts
  const cwethAddress = "0x0eEa56B813ca12C96d548905de48Ae4E781d8445";
  const vaultAddress = "0x8c27b96D2cb4F0cCE006c4bc75D5A360b567532E";
  
  // Get the contract instances
  const cweth = await ethers.getContractAt("ConfidentialWETH", cwethAddress);
  const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
  
  // Get a test account
  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  
  // Check current operator status
  const isOperatorBefore = await cweth.isOperator(deployer.address, vaultAddress);
  console.log("Is vault operator before:", isOperatorBefore);
  
  // Set operator with correct timestamp
  const until = BigInt(Math.floor(Date.now() / 1000) + 3600); // Current timestamp + 1 hour
  console.log("Setting operator until timestamp:", until.toString());
  
  try {
    const setOperatorTx = await cweth.setOperator(vaultAddress, until);
    console.log("Set operator transaction:", setOperatorTx.hash);
    await setOperatorTx.wait();
    console.log("Set operator successful");
    
    // Check operator status after
    const isOperatorAfter = await cweth.isOperator(deployer.address, vaultAddress);
    console.log("Is vault operator after:", isOperatorAfter);
    
    // Check the actual operator data
    try {
      const operatorData = await cweth.operators(deployer.address, vaultAddress);
      console.log("Operator data:", operatorData.toString());
    } catch (error) {
      console.log("Error getting operator data:", error.message);
    }
    
  } catch (error) {
    console.log("Error setting operator:", error.message);
    console.log("Error details:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
