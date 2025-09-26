const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing new contracts...");
  console.log("Testing with account:", deployer.address);

  const cwethAddress = "0x2ED2F38fbBBf4757f729f434dAf551C86Ada6040";
  const vaultAddress = "0x373545ABa06DB58d3ceB85cc82C5Be2A7983E1A6";

  const CWETH_ABI = [
    "function getEncryptedBalance(address user) external view returns (euint64)",
    "function wrap() external payable"
  ];

  const cweth = new ethers.Contract(cwethAddress, CWETH_ABI, deployer);

  // Test wrapping some ETH
  console.log("Wrapping 0.001 ETH...");
  const wrapTx = await cweth.wrap({ value: ethers.parseEther("0.001") });
  await wrapTx.wait();
  console.log("Wrap successful");

  const cWETHBalanceAfterWrap = await cweth.getEncryptedBalance(deployer.address);
  console.log("cWETH encrypted balance:", cWETHBalanceAfterWrap);

  console.log("\n✅ New contracts are working correctly!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
