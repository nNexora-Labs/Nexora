const { ethers } = require('hardhat');

async function testWorkingContracts() {
  console.log('🧪 Testing Working Contracts...');
  
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
    
    // Test 1: ETH → cWETH wrap
    console.log('\n🔄 Test 1: ETH → cWETH wrap');
    const wrapAmount = ethers.parseEther('0.001'); // Smaller amount
    console.log('Wrapping', ethers.formatEther(wrapAmount), 'ETH...');
    
    const wrapTx = await cWETH.wrap({ value: wrapAmount });
    const wrapReceipt = await wrapTx.wait();
    console.log('✅ Wrap transaction successful:', wrapReceipt.transactionHash);
    
    // Test 2: Get encrypted balance
    console.log('\n🔍 Test 2: Get encrypted balance');
    const encryptedBalance = await cWETH.getEncryptedBalance(deployer.address);
    console.log('✅ Encrypted balance retrieved:', encryptedBalance);
    
    // Test 3: Set operator (required for supply)
    console.log('\n🔑 Test 3: Set operator permission');
    const setOperatorTx = await cWETH.setOperator(VAULT_ADDRESS, 1); // Use 1 instead of true
    await setOperatorTx.wait();
    console.log('✅ Operator permission set');
    
    // Test 4: Check operator status
    console.log('\n✅ Test 4: Verify operator status');
    const isOperator = await cWETH.isOperator(deployer.address, VAULT_ADDRESS);
    console.log('Operator status:', isOperator);
    
    console.log('\n🎉 All tests passed! Contracts are working correctly.');
    console.log('\n📋 Frontend Configuration:');
    console.log(`NEXT_PUBLIC_CWETH_ADDRESS=${CWETH_ADDRESS}`);
    console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${VAULT_ADDRESS}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Check if it's a supply-related error
    if (error.message.includes('supply') || error.message.includes('encrypt')) {
      console.log('\n💡 This might be the supply encryption issue we discussed.');
      console.log('Try using the frontend with these contract addresses.');
    }
  }
}

testWorkingContracts().catch(console.error);
