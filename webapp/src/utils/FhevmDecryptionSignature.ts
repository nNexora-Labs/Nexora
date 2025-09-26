'use client';

import { ethers } from "ethers";

// Types based on the official Zama example
export interface EIP712Type {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    UserDecryptRequestVerification: Array<{
      name: string;
      type: string;
    }>;
  };
  message: {
    publicKey: string;
    contract: string;
    startTime: number;
    duration: number;
  };
}

export interface FhevmDecryptionSignatureType {
  publicKey: string;
  privateKey: string;
  signature: string;
  startTimestamp: number;
  durationDays: number;
  userAddress: `0x${string}`;
  contractAddresses: `0x${string}`[];
  eip712: EIP712Type;
}

export interface FhevmInstance {
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number
  ) => EIP712Type;
  generateKeypair: () => { publicKey: string; privateKey: string };
  userDecrypt: (
    handles: Array<{ handle: string; contractAddress: string }>,
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number
  ) => Promise<Record<string, string | bigint | boolean>>;
}

function _timestampNow(): number {
  return Math.floor(Date.now() / 1000);
}

class FhevmDecryptionSignatureStorageKey {
  #contractAddresses: `0x${string}`[];
  #userAddress: `0x${string}`;
  #publicKey: string | undefined;
  #key: string;

  constructor(
    instance: FhevmInstance,
    contractAddresses: string[],
    userAddress: string,
    publicKey?: string
  ) {
    if (!ethers.isAddress(userAddress)) {
      throw new TypeError(`Invalid address ${userAddress}`);
    }

    const sortedContractAddresses = (
      contractAddresses as `0x${string}`[]
    ).sort();

    const emptyEIP712 = instance.createEIP712(
      publicKey ?? ethers.ZeroAddress,
      sortedContractAddresses,
      0,
      0
    );

    try {
      const hash = ethers.TypedDataEncoder.hash(
        emptyEIP712.domain,
        { UserDecryptRequestVerification: emptyEIP712.types.UserDecryptRequestVerification },
        emptyEIP712.message
      );

      this.#contractAddresses = sortedContractAddresses;
      this.#userAddress = userAddress as `0x${string}`;

      this.#key = `${userAddress}:${hash}`;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  get contractAddresses(): `0x${string}`[] {
    return this.#contractAddresses;
  }

  get userAddress(): `0x${string}` {
    return this.#userAddress;
  }

  get publicKey(): string | undefined {
    return this.#publicKey;
  }

  get key(): string {
    return this.#key;
  }
}

export class FhevmDecryptionSignature {
  #publicKey: string;
  #privateKey: string;
  #signature: string;
  #startTimestamp: number;
  #durationDays: number;
  #userAddress: `0x${string}`;
  #contractAddresses: `0x${string}`[];
  #eip712: EIP712Type;

  private constructor(parameters: FhevmDecryptionSignatureType) {
    if (!FhevmDecryptionSignature.checkIs(parameters)) {
      throw new TypeError("Invalid FhevmDecryptionSignatureType");
    }
    this.#publicKey = parameters.publicKey;
    this.#privateKey = parameters.privateKey;
    this.#signature = parameters.signature;
    this.#startTimestamp = parameters.startTimestamp;
    this.#durationDays = parameters.durationDays;
    this.#userAddress = parameters.userAddress;
    this.#contractAddresses = parameters.contractAddresses;
    this.#eip712 = parameters.eip712;
  }

  public get privateKey() {
    return this.#privateKey;
  }

  public get publicKey() {
    return this.#publicKey;
  }

  public get signature() {
    return this.#signature;
  }

  public get contractAddresses() {
    return this.#contractAddresses;
  }

  public get startTimestamp() {
    return this.#startTimestamp;
  }

  public get durationDays() {
    return this.#durationDays;
  }

  public get userAddress() {
    return this.#userAddress;
  }

  static checkIs(s: unknown): s is FhevmDecryptionSignatureType {
    if (!s || typeof s !== "object") {
      return false;
    }
    if (!("publicKey" in s && typeof s.publicKey === "string")) {
      return false;
    }
    if (!("privateKey" in s && typeof s.privateKey === "string")) {
      return false;
    }
    if (!("signature" in s && typeof s.signature === "string")) {
      return false;
    }
    if (!("startTimestamp" in s && typeof s.startTimestamp === "number")) {
      return false;
    }
    if (!("durationDays" in s && typeof s.durationDays === "number")) {
      return false;
    }
    if (!("contractAddresses" in s && Array.isArray(s.contractAddresses))) {
      return false;
    }
    for (let i = 0; i < s.contractAddresses.length; ++i) {
      if (typeof s.contractAddresses[i] !== "string") return false;
      if (!s.contractAddresses[i].startsWith("0x")) return false;
    }
    if (
      !(
        "userAddress" in s &&
        typeof s.userAddress === "string" &&
        s.userAddress.startsWith("0x")
      )
    ) {
      return false;
    }
    if (!("eip712" in s && typeof s.eip712 === "object" && s.eip712 !== null)) {
      return false;
    }

    return true;
  }

  toJSON() {
    return {
      publicKey: this.#publicKey,
      privateKey: this.#privateKey,
      signature: this.#signature,
      startTimestamp: this.#startTimestamp,
      durationDays: this.#durationDays,
      userAddress: this.#userAddress,
      contractAddresses: this.#contractAddresses,
      eip712: this.#eip712,
    };
  }

  static fromJSON(json: unknown) {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    return new FhevmDecryptionSignature(data);
  }

  equals(s: FhevmDecryptionSignatureType) {
    return s.signature === this.#signature;
  }

  isValid(): boolean {
    return (
      _timestampNow() < this.#startTimestamp + this.#durationDays * 24 * 60 * 60
    );
  }

  async saveToLocalStorage(withPublicKey: boolean = false) {
    try {
      const value = JSON.stringify(this);

      const storageKey = new FhevmDecryptionSignatureStorageKey(
        // We need to create a mock instance for the storage key
        {
          createEIP712: () => ({
            domain: { name: 'FHEVM', version: '1', chainId: 11155111, verifyingContract: '0x0000000000000000000000000000000000000000' },
            types: { UserDecryptRequestVerification: [] },
            message: { publicKey: '', contract: '', startTime: 0, duration: 0 }
          }),
          generateKeypair: () => ({ publicKey: '', privateKey: '' }),
          userDecrypt: async () => ({})
        } as FhevmInstance,
        this.#contractAddresses,
        this.#userAddress,
        withPublicKey ? this.#publicKey : undefined
      );
      
      localStorage.setItem(storageKey.key, value);
      console.log(
        `signature saved! contracts=${this.#contractAddresses.length}`
      );
    } catch {
      console.error(
        `FhevmDecryptionSignature.saveToLocalStorage() failed!`
      );
    }
  }

  static async loadFromLocalStorage(
    instance: FhevmInstance,
    contractAddresses: string[],
    userAddress: string,
    publicKey?: string
  ): Promise<FhevmDecryptionSignature | null> {
    try {
      const storageKey = new FhevmDecryptionSignatureStorageKey(
        instance,
        contractAddresses,
        userAddress,
        publicKey
      );

      const result = localStorage.getItem(storageKey.key);

      if (!result) {
        console.warn(`Could not load signature! key=${storageKey.key}`);
        return null;
      }

      try {
        const kps = FhevmDecryptionSignature.fromJSON(result);
        if (!kps.isValid()) {
          return null;
        }

        return kps;
      } catch {
        return null;
      }
    } catch {
      console.error(
        `FhevmDecryptionSignature.loadFromLocalStorage() failed!`
      );
      return null;
    }
  }

  static async new(
    instance: FhevmInstance,
    contractAddresses: string[],
    publicKey: string,
    privateKey: string,
    signer: ethers.Signer
  ): Promise<FhevmDecryptionSignature | null> {
    try {
      const userAddress = (await signer.getAddress()) as `0x${string}`;
      const startTimestamp = _timestampNow();
      const durationDays = 365;
      const eip712 = instance.createEIP712(
        publicKey,
        contractAddresses,
        startTimestamp,
        durationDays
      );
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );
      return new FhevmDecryptionSignature({
        publicKey,
        privateKey,
        contractAddresses: contractAddresses as `0x${string}`[],
        startTimestamp,
        durationDays,
        signature,
        eip712: eip712 as EIP712Type,
        userAddress,
      });
    } catch {
      return null;
    }
  }

  static async loadOrSign(
    instance: FhevmInstance,
    contractAddresses: string[],
    signer: ethers.Signer,
    keyPair?: { publicKey: string; privateKey: string }
  ): Promise<FhevmDecryptionSignature | null> {
    const userAddress = (await signer.getAddress()) as `0x${string}`;

    const cached: FhevmDecryptionSignature | null =
      await FhevmDecryptionSignature.loadFromLocalStorage(
        instance,
        contractAddresses,
        userAddress,
        keyPair?.publicKey
      );

    if (cached) {
      return cached;
    }

    const { publicKey, privateKey } = keyPair ?? instance.generateKeypair();

    const sig = await FhevmDecryptionSignature.new(
      instance,
      contractAddresses,
      publicKey,
      privateKey,
      signer
    );

    if (!sig) {
      return null;
    }

    await sig.saveToLocalStorage(Boolean(keyPair?.publicKey));

    return sig;
  }
}
