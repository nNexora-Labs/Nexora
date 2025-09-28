const { ethers } = require("hardhat");

async function main() {
  const vaultAddr = "0xff0154c4f4ed81e3345d35c881d1ca6db4d280ee"; 
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
