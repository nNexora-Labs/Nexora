const { ethers } = require("hardhat");

async function main() {
  console.log("Testing direct supply flow...");
  
  // Get the deployed contracts
  const cwethAddress = "0x0eEa56B813ca12C96d548905de48Ae4E781d8445";
  const vaultAddress = "0x8c27b96D2cb4F0cCE006c4bc75D5A360b567532E";
  
  // Get the contract instances
  const cweth = await ethers.getContractAt("ConfidentialWETH", cwethAddress);
  const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
  
  // Get a test account
  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  
  // First, wrap some ETH to get cWETH
  console.log("Wrapping 0.001 ETH...");
  const wrapTx = await cweth.wrap({ value: ethers.parseEther("0.001") });
  await wrapTx.wait();
  console.log("Wrap successful");
  
  // Check cWETH balance
  const balance = await cweth.getEncryptedBalance(deployer.address);
  console.log("cWETH encrypted balance:", balance);
  
  // Now try to call the vault's supply function directly
  // But first, we need to set the vault as an operator
  console.log("Setting vault as operator...");
  const setOperatorTx = await cweth.setOperator(vaultAddress, Math.floor(Date.now() / 1000) + 3600);
  await setOperatorTx.wait();
  console.log("Operator set successfully");
  
  // Check if vault is operator
  const isOperator = await cweth.isOperator(deployer.address, vaultAddress);
  console.log("Is vault operator:", isOperator);
  
  // Now try to call confidentialTransferFrom from the vault
  // This should trigger the vault's onConfidentialTransferReceived
  console.log("Attempting confidentialTransferFrom...");
  try {
    // We need to call this from the vault contract, not directly
    // Let me try a different approach
    console.log("This approach won't work - we need encrypted values");
  } catch (error) {
    console.log("Expected error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
