const { ethers } = require("hardhat");

async function main() {
  console.log("Testing simple supply flow...");
  
  // Get the deployed contracts
  const cwethAddress = "0x0eEa56B813ca12C96d548905de48Ae4E781d8445";
  const vaultAddress = "0x8c27b96D2cb4F0cCE006c4bc75D5A360b567532E";
  
  // Get the contract instances
  const cweth = await ethers.getContractAt("ConfidentialWETH", cwethAddress);
  const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
  
  // Get a test account
  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  
  // Check cWETH balance
  try {
    const balance = await cweth.getEncryptedBalance(deployer.address);
    console.log("cWETH encrypted balance:", balance);
  } catch (error) {
    console.log("Error getting cWETH balance:", error.message);
  }
  
  // Check vault shares
  try {
    const shares = await vault.getEncryptedShares(deployer.address);
    console.log("Vault encrypted shares:", shares);
  } catch (error) {
    console.log("Error getting vault shares:", error.message);
  }
  
  // Try to wrap some ETH first
  console.log("Wrapping 0.001 ETH...");
  try {
    const wrapTx = await cweth.wrap({ value: ethers.parseEther("0.001") });
    console.log("Wrap transaction:", wrapTx.hash);
    await wrapTx.wait();
    console.log("Wrap successful");
    
    // Check balance after wrap
    const balanceAfter = await cweth.getEncryptedBalance(deployer.address);
    console.log("cWETH balance after wrap:", balanceAfter);
  } catch (error) {
    console.log("Error wrapping ETH:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
