import { expect } from "chai";
import { ethers } from "hardhat";
import { encryptAmountForContract } from "./helpers/relayer";

// Minimal ABIs tailored to the functions we use
const CWETH_ABI = [
  // setOperator(operator, until)
  {
    inputs: [
      { internalType: "address", name: "operator", type: "address" },
      { internalType: "uint48", name: "until", type: "uint48" },
    ],
    name: "setOperator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // isOperator(holder, operator) -> bool
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "operator", type: "address" },
    ],
    name: "isOperator",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
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
  // supply(bytes encryptedAmount, bytes inputProof)
  {
    inputs: [
      { internalType: "bytes", name: "encryptedAmount", type: "bytes" },
      { internalType: "bytes", name: "inputProof", type: "bytes" },
    ],
    name: "supply",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // getEncryptedShares(user) -> euint64 (encoded as bytes32)
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getEncryptedShares",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

describe("Integration: Vault Pull Flow (operator = vault, tx to vault)", function () {
  // Remote calls to Sepolia can be slow
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

  it("setOperator -> supply(encrypted) -> shares updated", async () => {
    // Addresses must be set in env
    const CWETH_ADDRESS = requireEnv("NEXT_PUBLIC_CWETH_ADDRESS");
    const VAULT_ADDRESS = requireEnv("NEXT_PUBLIC_VAULT_ADDRESS");

    // Signer configured by hardhat.config.ts (sepolia network)
    const [signer] = await ethers.getSigners();
    const user = await signer.getAddress();

    // Instantiate contracts
    const cweth = new ethers.Contract(CWETH_ADDRESS, CWETH_ABI, signer);
    const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

    // 1) Grant operator permission to the vault on cWETH
    const until = Math.floor(Date.now() / 1000) + 3600; // +1h
    const setOpTx = await cweth.setOperator(VAULT_ADDRESS, until);
    const setOpRcpt = await setOpTx.wait();
    expect(setOpRcpt?.status).to.eq(1);

    const isOp: boolean = await cweth.isOperator(user, VAULT_ADDRESS);
    expect(isOp).to.eq(true, "vault should be operator");

    // 2) Encrypt amount bound to the VAULT (pull pattern)
    // Use a small test amount to avoid large costs
    const amountWei = ethers.parseEther("0.001");
    const { encryptedAmount, inputProof } = await encryptAmountForContract(VAULT_ADDRESS, user, amountWei);

    // 3) Call vault.supply(encryptedAmount, inputProof)
    const supplyTx = await vault.supply(encryptedAmount, inputProof);
    const supplyRcpt = await supplyTx.wait();
    expect(supplyRcpt?.status).to.eq(1, "supply transaction should succeed");

    // 4) Read shares; they should be non-zero after supply
    const shares: string = await vault.getEncryptedShares(user);
    expect(typeof shares).to.eq("string");
    expect(shares.startsWith("0x")).to.eq(true);
    expect(shares.length).to.be.greaterThan(2, "encrypted shares should not be empty");
  });
});