const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy ConfidentialWETH
  console.log("\nDeploying ConfidentialWETH...");
  const ConfidentialWETH = await ethers.getContractFactory("ConfidentialWETH");
  const cWETH = await ConfidentialWETH.deploy();
  await cWETH.waitForDeployment();
  const cWETHAddress = await cWETH.getAddress();
  console.log("ConfidentialWETH deployed to:", cWETHAddress);

  // Deploy ConfidentialLendingVault
  console.log("\nDeploying ConfidentialLendingVault...");
  const ConfidentialLendingVault = await ethers.getContractFactory("ConfidentialLendingVault");
  const vault = await ConfidentialLendingVault.deploy(cWETHAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("ConfidentialLendingVault deployed to:", vaultAddress);

  console.log("\n=== NEW CONTRACT ADDRESSES ===");
  console.log(`NEXT_PUBLIC_CWETH_ADDRESS=${cWETHAddress}`);
  console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${vaultAddress}`);
  console.log("===============================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
