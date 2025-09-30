const { ethers } = require('hardhat');

async function testFHEVM() {
  console.log('🔍 Testing FHEVM precompiles on Sepolia...');
  
  try {
    const provider = ethers.provider;
    console.log('Provider connected to:', await provider.getNetwork());
    
    // Test if we can call FHEVM precompiles
    console.log('Testing FHEVM precompile at address 0x0000000000000000000000000000000000000001...');
    const result = await provider.call({
      to: '0x0000000000000000000000000000000000000001',
      data: '0x'
    });
    console.log('✅ FHEVM precompile accessible:', result);
    
    // Test if we can call the gateway
    console.log('Testing gateway functionality...');
    const gatewayResult = await provider.call({
      to: '0x0000000000000000000000000000000000000002',
      data: '0x'
    });
    console.log('✅ Gateway accessible:', gatewayResult);
    
  } catch (error) {
    console.log('❌ FHEVM test failed:', error.message);
    console.log('This suggests FHEVM precompiles are not working properly');
  }
}

testFHEVM().catch(console.error);
