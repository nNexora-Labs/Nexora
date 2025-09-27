import { expect } from "chai";
import { ethers } from "hardhat";
import { encryptAmountForContract } from "./helpers/relayer";

// Minimal ABIs tailored to the functions we use
const CWETH_ABI = [
  // wrap() payable
  {
    inputs: [],
    name: "wrap",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  // confidentialTransferFrom(from, to, externalEuint64, inputProof) -> euint64
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "externalEuint64", name: "encryptedAmount", type: "bytes32" },
      { internalType: "bytes", name: "inputProof", type: "bytes" },
    ],
    name: "confidentialTransferFrom",
    outputs: [{ internalType: "euint64", name: "transferred", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // getEncryptedBalance(user) -> euint64 (encoded as bytes32)
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getEncryptedBalance",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const VAULT_ABI = [
  // getEncryptedShares(user) -> euint64 (encoded as bytes32)
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getEncryptedShares",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

describe("Integration: Token Push Flow (tx to cWETH, receiver updates vault)", function () {
  this.timeout(180_000);

  const requireEnv = (key: string) => {
    const v =
      process.env[key] ||
      (key.startsWith("NEXT_PUBLIC_") ? process.env[key.replace("NEXT_PUBLIC_", "")] : undefined);
    if (!v || v === "0x0000000000000000000000000000000000000000") {
      throw new Error(`Missing or invalid env ${key}`);
    }
    return v;
  };

  it("wrap -> confidentialTransferFrom(user->vault, encrypted) -> shares updated", async () => {
    const CWETH_ADDRESS = requireEnv("NEXT_PUBLIC_CWETH_ADDRESS");
    const VAULT_ADDRESS = requireEnv("NEXT_PUBLIC_VAULT_ADDRESS");

    const [signer] = await ethers.getSigners();
    const user = await signer.getAddress();

    const cweth = new ethers.Contract(CWETH_ADDRESS, CWETH_ABI, signer);
    const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

    // 1) Wrap small amount to ensure balance
    const wrapTx = await cweth.wrap({ value: ethers.parseEther("0.001") });
    const wrapRcpt = await wrapTx.wait();
    expect(wrapRcpt?.status).to.eq(1, "wrap should succeed");

    // 2) Encrypt amount bound to the TOKEN (push pattern)
    const amountWei = ethers.parseEther("0.0005");
    const { encryptedAmount, inputProof } = await encryptAmountForContract(CWETH_ADDRESS, user, amountWei);

    // 3) Call cWETH.confidentialTransferFrom(user, vault, encryptedAmount, inputProof)
    const xferTx = await cweth.confidentialTransferFrom(user, VAULT_ADDRESS, encryptedAmount, inputProof);
    const xferRcpt = await xferTx.wait();
    expect(xferRcpt?.status).to.eq(1, "confidentialTransferFrom should succeed");

    // 4) Shares should now be non-empty
    const shares: string = await vault.getEncryptedShares(user);
    expect(typeof shares).to.eq("string");
    expect(shares.startsWith("0x")).to.eq(true);
    expect(shares.length).to.be.greaterThan(2, "encrypted shares should not be empty");
  });
});