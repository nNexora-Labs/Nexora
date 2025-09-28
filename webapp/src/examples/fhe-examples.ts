'use client';

// Example implementation of FHE operations with Confidential Lending Protocol
// This file demonstrates the correct usage of Zama Relayer SDK

import { encryptAndRegister, decryptUserData } from '../utils/fhe';

// Example: How to supply encrypted ETH to the vault
export const supplyEncryptedETH = async (
  vaultAddress: string,
  userAddress: string,
  amountInWei: bigint,
  contractInstance: any
) => {
  try {
    // Step 1: Create encrypted input buffer
    const ciphertexts = await encryptAndRegister(
      vaultAddress,
      userAddress,
      amountInWei
    );

    // Step 2: Call the contract's supplyEncrypted function
    const tx = await contractInstance.supplyEncrypted(
      ciphertexts.handles[0], // encrypted amount
      ciphertexts.inputProof   // proof of encryption
    );

    return tx;
  } catch (error) {
    console.error('Failed to supply encrypted ETH:', error);
    throw error;
  }
};

// Example: How to withdraw encrypted shares from the vault
export const withdrawEncryptedShares = async (
  vaultAddress: string,
  userAddress: string,
  sharesInWei: bigint,
  contractInstance: any
) => {
  try {
    // Step 1: Create encrypted input buffer for shares
    const ciphertexts = await encryptAndRegister(
      vaultAddress,
      userAddress,
      sharesInWei
    );

    // Step 2: Call the contract's withdrawEncrypted function
    const tx = await contractInstance.withdrawEncrypted(
      ciphertexts.handles[0], // encrypted shares
      ciphertexts.inputProof   // proof of encryption
    );

    return tx;
  } catch (error) {
    console.error('Failed to withdraw encrypted shares:', error);
    throw error;
  }
};

// Example: How to get and decrypt user's encrypted balance
export const getUserEncryptedBalance = async (
  contractInstance: any,
  userAddress: string,
  contractAddress: string,
  signer: any
) => {
  try {
    // Step 1: Get encrypted balance from contract
    const encryptedBalance = await contractInstance.getEncryptedBalance(userAddress);

    // Step 2: Decrypt the balance for UI display
    const decryptedBalance = await decryptUserData(encryptedBalance, userAddress, contractAddress, signer);

    return decryptedBalance;
  } catch (error) {
    console.error('Failed to get encrypted balance:', error);
    return null;
  }
};

// Example: How to transfer encrypted tokens between users
export const transferEncryptedTokens = async (
  tokenAddress: string,
  fromAddress: string,
  toAddress: string,
  amountInWei: bigint,
  contractInstance: any
) => {
  try {
    // Step 1: Create encrypted input buffer
    const ciphertexts = await encryptAndRegister(
      tokenAddress,
      fromAddress,
      amountInWei
    );

    // Step 2: Call the contract's transferEncrypted function
    const tx = await contractInstance.transferEncrypted(
      toAddress,
      ciphertexts.handles[0], // encrypted amount
      ciphertexts.inputProof   // proof of encryption
    );

    return tx;
  } catch (error) {
    console.error('Failed to transfer encrypted tokens:', error);
    throw error;
  }
};

// Example: Complete supply flow with FHE
export const completeSupplyFlow = async (
  vaultAddress: string,
  userAddress: string,
  ethAmount: number,
  contractInstance: any,
  contractAddress: string,
  signer: any
) => {
  try {
    // Convert ETH to wei
    const amountInWei = BigInt(Math.floor(ethAmount * 1e18));

    // Step 1: Encrypt the amount
    const ciphertexts = await encryptAndRegister(
      vaultAddress,
      userAddress,
      amountInWei
    );

    // Step 2: Supply encrypted ETH to vault
    const supplyTx = await contractInstance.supplyEncrypted(
      ciphertexts.handles[0],
      ciphertexts.inputProof
    );

    // Step 3: Wait for transaction confirmation
    await supplyTx.wait();

    // Step 4: Get updated encrypted balance
    const encryptedBalance = await contractInstance.getEncryptedBalance(userAddress);
    
    // Step 5: Decrypt balance for display
    const decryptedBalance = await decryptUserData(encryptedBalance, userAddress, contractAddress, signer);

    return {
      transaction: supplyTx,
      encryptedBalance,
      decryptedBalance
    };
  } catch (error) {
    console.error('Complete supply flow failed:', error);
    throw error;
  }
};
