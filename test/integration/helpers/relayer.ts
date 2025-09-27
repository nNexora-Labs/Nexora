import { ethers } from "ethers";

// Use CommonJS import style to be resilient to package export formats
// eslint-disable-next-line @typescript-eslint/no-var-requires
const relayerSDK: any = require("@zama-fhe/relayer-sdk");

// Small helper to read env with fallbacks
const rpcFromEnv = () =>
  process.env.SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://sepolia.infura.io/v3/edae100994ea476180577c9218370251";

// Create a Relayer instance suitable for Node test environment.
// Returns an object exposing createEncryptedInput(contract, user)
export async function getRelayerInstance() {
  if (!relayerSDK) {
    throw new Error("@zama-fhe/relayer-sdk not available in node environment");
  }

  if (typeof relayerSDK.initSDK === "function") {
    await relayerSDK.initSDK();
  }

  // Use Sepolia defaults and allow overriding network URL from env
  const config = {
    ...(relayerSDK.SepoliaConfig || {}),
    network: rpcFromEnv(),
  };

  const instance = await relayerSDK.createInstance(config);
  if (!instance || typeof instance.createEncryptedInput !== "function") {
    throw new Error("Relayer instance invalid: missing createEncryptedInput");
  }
  return instance;
}

// Produce encryptedAmount handle and inputProof for a uint64 amount
export async function encryptAmountForContract(
  contractAddress: string,
  userAddress: string,
  amountWei: bigint
): Promise<{ encryptedAmount: `0x${string}`; inputProof: `0x${string}` }> {
  const instance = await getRelayerInstance();

  const input = instance.createEncryptedInput(
    ethers.getAddress(contractAddress),
    ethers.getAddress(userAddress)
  );

  // FHE uint64 input
  input.add64(amountWei);

  const enc = await input.encrypt();
  const toHex = (v: any): `0x${string}` => {
    if (typeof v === "string") {
      return (v.startsWith("0x") ? v : `0x${v}`) as `0x${string}`;
    }
    if (v instanceof Uint8Array) {
      return ("0x" +
        Array.from(v)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")) as `0x${string}`;
    }
    throw new Error("Unsupported encrypted payload type");
  };

  // Ensure the encrypted handle is exactly bytes32 (0x + 64 hex chars)
  const normalizeBytes32 = (hex: `0x${string}`): `0x${string}` => {
    const n = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (n.length === 64) return hex as `0x${string}`;
    if (n.length < 64) return (`0x${n.padStart(64, "0")}`) as `0x${string}`;
    // If longer than 32 bytes, it's invalid for bytes32
    throw new Error(`encryptedAmount handle length ${n.length} exceeds 32 bytes`);
  };

  const encryptedAmount = normalizeBytes32(toHex(enc.handles?.[0]));
  const inputProof = toHex(enc.inputProof);

  return { encryptedAmount, inputProof };
}