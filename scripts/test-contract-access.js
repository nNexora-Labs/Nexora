const { ethers } = require('hardhat');

async function testContractAccess() {
  console.log('🧪 Testing Contract Access (No ETH Required)...');
  
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  // Working contract addresses
  const CWETH_ADDRESS = '0xdB62c3cfaAF3972fEB127f9fB5Eb9f533DbaA5e7';
  const VAULT_ADDRESS = '0xff0154c4f4ed81e3345d35c881d1ca6db4d280ee';
  
  try {
    // Get contract instances
    const cWETH = await ethers.getContractAt('ConfidentialWETH', CWETH_ADDRESS);
    const vault = await ethers.getContractAt('ConfidentialLendingVault', VAULT_ADDRESS);
    
    console.log('✅ Contracts loaded successfully');
    console.log('cWETH address:', CWETH_ADDRESS);
    console.log('Vault address:', VAULT_ADDRESS);
    
    // Test 1: Check contract names
    console.log('\n📋 Test 1: Contract Information');
    const cWETHName = await cWETH.name();
    const cWETHSymbol = await cWETH.symbol();
    console.log('✅ cWETH Name:', cWETHName);
    console.log('✅ cWETH Symbol:', cWETHSymbol);
    
    // Test 2: Check owner
    console.log('\n👤 Test 2: Contract Ownership');
    const cWETHOwner = await cWETH.owner();
    const vaultOwner = await vault.owner();
    console.log('✅ cWETH Owner:', cWETHOwner);
    console.log('✅ Vault Owner:', vaultOwner);
    
    // Test 3: Check encrypted balance (should work even with 0 balance)
    console.log('\n🔍 Test 3: Encrypted Balance Access');
    const encryptedBalance = await cWETH.getEncryptedBalance(deployer.address);
    console.log('✅ Encrypted balance retrieved:', encryptedBalance);
    
    // Test 4: Check operator status
    console.log('\n🔑 Test 4: Operator Status');
    const isOperator = await cWETH.isOperator(deployer.address, VAULT_ADDRESS);
    console.log('✅ Operator status:', isOperator);
    
    // Test 5: Check vault asset
    console.log('\n🏦 Test 5: Vault Asset');
    const vaultAsset = await vault.asset();
    console.log('✅ Vault asset:', vaultAsset);
    console.log('✅ Matches cWETH address:', vaultAsset.toLowerCase() === CWETH_ADDRESS.toLowerCase());
    
    console.log('\n🎉 All contract access tests passed!');
    console.log('\n📋 Frontend Configuration:');
    console.log(`NEXT_PUBLIC_CWETH_ADDRESS=${CWETH_ADDRESS}`);
    console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${VAULT_ADDRESS}`);
    console.log('\n💡 You can now test the full flow in your frontend:');
    console.log('1. ETH → cWETH swap');
    console.log('2. Set operator permission');
    console.log('3. Supply cWETH to vault');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testContractAccess().catch(console.error);
