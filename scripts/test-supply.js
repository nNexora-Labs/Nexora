const { ethers } = require("hardhat");

async function main() {
  console.log("Testing supply flow...");
  
  // Get the deployed contracts
  const cwethAddress = "0x0eEa56B813ca12C96d548905de48Ae4E781d8445";
  const vaultAddress = "0x8c27b96D2cb4F0cCE006c4bc75D5A360b567532E";
  
  // Get the contract instances
  const cweth = await ethers.getContractAt("ConfidentialWETH", cwethAddress);
  const vault = await ethers.getContractAt("ConfidentialLendingVault", vaultAddress);
  
  console.log("cWETH address:", cwethAddress);
  console.log("Vault address:", vaultAddress);
  
  // Check if vault implements the receiver interface
  try {
    const interfaceId = await vault.interfaceId();
    console.log("Vault interface ID:", interfaceId);
  } catch (error) {
    console.log("Vault interface check failed:", error.message);
  }
  
  // Check vault's asset (should be cWETH)
  const asset = await vault.asset();
  console.log("Vault asset:", asset);
  console.log("Asset matches cWETH:", asset.toLowerCase() === cwethAddress.toLowerCase());
  
  // Check if we can call the vault's receiver function directly
  try {
    // This should fail because we're not calling from cWETH contract
    await vault.onConfidentialTransferReceived(
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x"
    );
  } catch (error) {
    console.log("Expected error when calling receiver directly:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
