import { expect } from "chai";
import { ethers } from "hardhat";

describe("Function selector sanity checks", () => {
  it("matches confidentialTransferFrom(address,address,bytes32,bytes) selector 0xe064b9bb", () => {
    const sig = "confidentialTransferFrom(address,address,bytes32,bytes)";
    const selector = (ethers.id(sig) as `0x${string}`).slice(0, 10);
    expect(selector).to.equal("0xe064b9bb");
  });

  it("computes selector for confidentialTransferFromAndCall(address,address,bytes32,bytes)", () => {
    const sig = "confidentialTransferFromAndCall(address,address,bytes32,bytes)";
    const selector = (ethers.id(sig) as `0x${string}`).slice(0, 10);
    // No constant to compare to here; assert shape and stability
    expect(selector).to.match(/^0x[0-9a-fA-F]{8}$/);
  });

  it("computes selector for confidentialTransferFromAndCall(address,address,bytes32,bytes,bytes)", () => {
    const sig = "confidentialTransferFromAndCall(address,address,bytes32,bytes,bytes)";
    const selector = (ethers.id(sig) as `0x${string}`).slice(0, 10);
    expect(selector).to.match(/^0x[0-9a-fA-F]{8}$/);
  });

  it("computes selector for vault supply(bytes32,bytes)", () => {
    const sig = "supply(bytes32,bytes)";
    const selector = (ethers.id(sig) as `0x${string}`).slice(0, 10);
    expect(selector).to.match(/^0x[0-9a-fA-F]{8}$/);
  });
});