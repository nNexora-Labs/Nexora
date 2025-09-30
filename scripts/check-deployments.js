const { ethers } = require("hardhat");

async function main() {
  console.log("Checking current deployment status...");

  // Check if contracts are deployed at the expected addresses
  const expectedAddresses = {
    cWETH: "0x0eEa56B813ca12C96d548905de48Ae4E781d8445",
    vault: "0x8c27b96D2cb4F0cCE006c4bc75D5A360b567532E"
  };

  const [deployer] = await ethers.getSigners();
  console.log("Checking with account:", deployer.address);

  for (const [name, address] of Object.entries(expectedAddresses)) {
    try {
      console.log(`\nChecking ${name} at ${address}...`);

      // Try to get contract code
      const code = await ethers.provider.getCode(address);
      if (code === "0x") {
        console.log(`❌ ${name} not deployed at ${address}`);
      } else {
        console.log(`✅ ${name} is deployed at ${address}`);

        // Try to get basic contract info
        if (name === "cWETH") {
          const cWETH = await ethers.getContractAt("ConfidentialWETH", address);
          const totalSupply = await cWETH.getEncryptedTotalSupply();
          console.log(`   Total supply: ${totalSupply}`);
        } else if (name === "vault") {
          const vault = await ethers.getContractAt("ConfidentialLendingVault", address);
          const asset = await vault.asset();
          const totalAssets = await vault.getEncryptedTotalAssets();
          console.log(`   Asset (cWETH): ${asset}`);
          console.log(`   Total assets: ${totalAssets}`);
        }
      }
    } catch (error) {
      console.log(`❌ Error checking ${name}:`, error.message);
    }
  }

  // Check if we can deploy new contracts
  console.log("\n=== Testing new deployment ===");
  try {
    const ConfidentialWETH = await ethers.getContractFactory("ConfidentialWETH");
    const cWETH = await ConfidentialWETH.deploy();
    await cWETH.waitForDeployment();
    const newCWETHAddress = await cWETH.getAddress();
    console.log("✅ Successfully deployed new cWETH at:", newCWETHAddress);

    const ConfidentialLendingVault = await ethers.getContractFactory("ConfidentialLendingVault");
    const vault = await ConfidentialLendingVault.deploy(newCWETHAddress);
    await vault.waitForDeployment();
    const newVaultAddress = await vault.getAddress();
    console.log("✅ Successfully deployed new vault at:", newVaultAddress);

    console.log("\n=== NEW CONTRACT ADDRESSES ===");
    console.log(`NEXT_PUBLIC_CWETH_ADDRESS=${newCWETHAddress}`);
    console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${newVaultAddress}`);
  } catch (error) {
    console.log("❌ Error deploying new contracts:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });