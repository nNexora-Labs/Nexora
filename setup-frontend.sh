#!/bin/bash

# Confidential Lending Protocol - Frontend Setup Script
# This script sets up the Next.js frontend with all required dependencies

echo "🚀 Setting up Confidential Lending Protocol Frontend..."

# Navigate to webapp directory
cd webapp

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env.local from template
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from template..."
    cp env.example .env.local
    echo "⚠️  Please update .env.local with your actual values:"
    echo "   - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
    echo "   - NEXT_PUBLIC_SEPOLIA_RPC_URL"
    echo "   - NEXT_PUBLIC_CWETH_ADDRESS (after deployment)"
    echo "   - NEXT_PUBLIC_VAULT_ADDRESS (after deployment)"
    echo "   - NEXT_PUBLIC_ZAMA_RELAYER_API_KEY"
else
    echo "✅ .env.local already exists"
fi

# Create necessary directories
mkdir -p src/components
mkdir -p src/app
mkdir -p public

echo "✅ Frontend setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your configuration"
echo "2. Deploy contracts: npm run deploy:sepolia"
echo "3. Update contract addresses in .env.local"
echo "4. Start development server: npm run dev"
echo ""
echo "For deployment:"
echo "1. Get WalletConnect Project ID from https://cloud.walletconnect.com/"
echo "2. Get Sepolia RPC URL from Infura/Alchemy"
echo "3. Deploy contracts and update addresses"
echo "4. Deploy frontend to Vercel or similar platform"
