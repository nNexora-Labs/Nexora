const { ethers } = require("hardhat");

async function main() {
  const vaultAddr = "0x6b8833f582760434620D1bff197D3ec661d95723"; 
  const provider = ethers.provider; // uses network in hardhat config
  const abi = [
    "function asset() view returns (address)",
    "function owner() view returns (address)"
  ];
  const vault = new ethers.Contract(vaultAddr, abi, provider);
  console.log("asset()", await vault.asset());
  console.log("owner()", await vault.owner());
}

main().catch((e)=>{console.error(e); process.exit(1);});
