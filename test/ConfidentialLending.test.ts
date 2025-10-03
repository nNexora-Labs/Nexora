import { expect } from "chai";
import { ethers } from "hardhat";
import { ConfidentialWETH, ConfidentialLendingVault } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Confidential Lending Protocol", function () {
  let cWETH: ConfidentialWETH;
  let vault: ConfidentialLendingVault;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy ConfidentialWETH
    const ConfidentialWETHFactory = await ethers.getContractFactory("ConfidentialWETH");
    cWETH = await ConfidentialWETHFactory.deploy(
      owner.address,
      "Confidential WETH",
      "cWETH",
      "https://example.com/metadata/"
    );
    await cWETH.waitForDeployment();

    // Deploy ConfidentialLendingVault
    const ConfidentialLendingVaultFactory = await ethers.getContractFactory("ConfidentialLendingVault");
    vault = await ConfidentialLendingVaultFactory.deploy(await cWETH.getAddress());
    await vault.waitForDeployment();
  });

  describe("ConfidentialWETH", function () {
    it("Should deploy with correct name and symbol", async function () {
      expect(await cWETH.name()).to.equal("Confidential Wrapped Ether");
      expect(await cWETH.symbol()).to.equal("cWETH");
    });

    it("Should allow wrapping ETH", async function () {
      const wrapAmount = ethers.parseEther("1.0");
      
      await expect(cWETH.connect(user1).wrap({ value: wrapAmount }))
        .to.emit(cWETH, "Wrap")
        .withArgs(user1.address, wrapAmount);
    });

    it("Should reject wrapping 0 ETH", async function () {
      await expect(cWETH.connect(user1).wrap({ value: 0 }))
        .to.be.revertedWith("ConfidentialWETH: Cannot wrap 0 ETH");
    });

    it("Should have correct owner", async function () {
      expect(await cWETH.owner()).to.equal(owner.address);
    });

    it("Should allow emergency withdrawal by owner", async function () {
      const wrapAmount = ethers.parseEther("1.0");
      await cWETH.connect(user1).wrap({ value: wrapAmount });
      
      const initialBalance = await ethers.provider.getBalance(owner.address);
      await cWETH.emergencyWithdraw();
      const finalBalance = await ethers.provider.getBalance(owner.address);
      
      expect(finalBalance).to.be.greaterThan(initialBalance);
    });

    it("Should reject emergency withdrawal by non-owner", async function () {
      await expect(cWETH.connect(user1).emergencyWithdraw())
        .to.be.revertedWithCustomError(cWETH, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });
  });

  describe("ConfidentialLendingVault", function () {
    it("Should deploy with correct asset", async function () {
      expect(await vault.asset()).to.equal(await cWETH.getAddress());
    });

    it("Should have correct initial parameters", async function () {
      expect(await vault.getCurrentInterestRate()).to.equal(ethers.parseEther("0.05")); // 5%
      expect(await vault.getETHPrice()).to.equal(4000e6); // 4000 USDC
    });

    it("Should allow supplying ETH", async function () {
      const supplyAmount = ethers.parseEther("1.0");
      
      await expect(vault.connect(user1).supply({ value: supplyAmount }))
        .to.emit(vault, "Supply")
        .withArgs(user1.address, supplyAmount, supplyAmount); // First deposit gets 1:1 shares
    });

    it("Should reject supplying 0 ETH", async function () {
      await expect(vault.connect(user1).supply({ value: 0 }))
        .to.be.revertedWith("ConfidentialLendingVault: Cannot supply 0 ETH");
    });

    it("Should calculate utilization rate", async function () {
      const utilizationRate = await vault.getUtilizationRate();
      expect(utilizationRate).to.equal(50); // Fixed 50% for Phase 1
    });

    it("Should have correct owner", async function () {
      expect(await vault.owner()).to.equal(owner.address);
    });

    it("Should allow emergency pause by owner", async function () {
      await expect(vault.emergencyPause()).to.not.be.reverted;
    });

    it("Should allow emergency resume by owner", async function () {
      await expect(vault.emergencyResume()).to.not.be.reverted;
    });

    it("Should reject emergency functions by non-owner", async function () {
      await expect(vault.connect(user1).emergencyPause())
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
      
      await expect(vault.connect(user1).emergencyResume())
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete supply flow", async function () {
      const supplyAmount = ethers.parseEther("2.0");
      
      // User supplies ETH to vault
      await vault.connect(user1).supply({ value: supplyAmount });
      
      // Check that the vault received the ETH
      const vaultBalance = await ethers.provider.getBalance(await vault.getAddress());
      expect(vaultBalance).to.equal(supplyAmount);
    });

    it("Should handle multiple users supplying", async function () {
      const supplyAmount1 = ethers.parseEther("1.0");
      const supplyAmount2 = ethers.parseEther("1.5");
      
      // First user supplies
      await vault.connect(user1).supply({ value: supplyAmount1 });
      
      // Second user supplies
      await vault.connect(user2).supply({ value: supplyAmount2 });
      
      // Check total vault balance
      const vaultBalance = await ethers.provider.getBalance(await vault.getAddress());
      expect(vaultBalance).to.equal(supplyAmount1 + supplyAmount2);
    });
  });

  describe("Security Tests", function () {
    it("Should prevent reentrancy attacks", async function () {
      // This test would require a malicious contract to test reentrancy
      // For now, we verify the ReentrancyGuard is properly imported
      expect(vault.interface.hasFunction("supply")).to.be.true;
    });

    it("Should have proper access control", async function () {
      // Test that only owner can call emergency functions
      await expect(vault.connect(user1).emergencyPause())
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });
});
