const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Debugging contract state issues...");

  const oldAddresses = {
    cWETH: "0x0eEa56B813ca12C96d548905de48Ae4E781d8445",
    vault: "0x8c27b96D2cb4F0cCE006c4bc75D5A360b567532E"
  };

  const newAddresses = {
    cWETH: "0xd85e31B582f40287A77C014C6C91433578001345",
    vault: "0x83845117cC30c8b080a14eD6e0ddc5dEbC7D10E6"
  };

  const [deployer] = await ethers.getSigners();
  console.log("Debugging with account:", deployer.address);

  // Test both old and new contracts
  for (const [label, addresses] of Object.entries({ "OLD": oldAddresses, "NEW": newAddresses }))) {
    console.log(`\n=== ${label} CONTRACTS ===`);

    try {
      // Check cWETH contract
      const cWETH = await ethers.getContractAt("ConfidentialWETH", addresses.cWETH);
      console.log(`\n📋 ${label} cWETH (${addresses.cWETH}):`);

      const totalSupply = await cWETH.getEncryptedTotalSupply();
      console.log(`   Total Supply: ${totalSupply}`);

      const deployerBalance = await cWETH.getEncryptedBalance(deployer.address);
      console.log(`   Deployer Balance: ${deployerBalance}`);

      // Check vault contract
      const vault = await ethers.getContractAt("ConfidentialLendingVault", addresses.vault);
      console.log(`\n🏦 ${label} Vault (${addresses.vault}):`);

      const asset = await vault.asset();
      console.log(`   Asset (cWETH): ${asset}`);

      const totalAssets = await vault.getEncryptedTotalAssets();
      console.log(`   Total Assets: ${totalAssets}`);

      const totalShares = await vault.getEncryptedTotalShares();
      console.log(`   Total Shares: ${totalShares}`);

      const deployerShares = await vault.getEncryptedShares(deployer.address);
      console.log(`   Deployer Shares: ${deployerShares}`);

      // Test wrap functionality
      console.log(`\n🔄 Testing wrap functionality...`);
      const wrapAmount = ethers.parseEther("0.001");

      try {
        const wrapTx = await cWETH.wrap({ value: wrapAmount });
        console.log(`   ✅ Wrap TX: ${wrapTx.hash}`);
        await wrapTx.wait();
        console.log(`   ✅ Wrap successful`);

        // Check balance after wrap
        const balanceAfter = await cWETH.getEncryptedBalance(deployer.address);
        console.log(`   Balance after wrap: ${balanceAfter}`);

      } catch (wrapError) {
        console.log(`   ❌ Wrap failed: ${wrapError.message}`);
      }

    } catch (error) {
      console.log(`❌ Error with ${label} contracts:`, error.message);
    }
  }

  // Test supply functionality
  console.log(`\n=== TESTING SUPPLY FUNCTIONALITY ===`);

  for (const [label, addresses] of Object.entries({ "OLD": oldAddresses, "NEW": newAddresses }))) {
    console.log(`\nTesting supply with ${label} contracts...`);

    try {
      const cWETH = await ethers.getContractAt("ConfidentialWETH", addresses.cWETH);
      const vault = await ethers.getContractAt("ConfidentialLendingVault", addresses.vault);

      // First set operator
      console.log(`   Setting vault as operator...`);
      const until = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      const setOperatorTx = await cWETH.setOperator(addresses.vault, until);
      console.log(`   ✅ Set operator TX: ${setOperatorTx.hash}`);
      await setOperatorTx.wait();

      // Check if operator is set
      const isOperator = await cWETH.isOperator(deployer.address, addresses.vault);
      console.log(`   Operator status: ${isOperator}`);

      console.log(`   ❌ Supply functionality requires FHEVM setup - skipping for now`);

    } catch (error) {
      console.log(`   ❌ Error testing supply: ${error.message}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });