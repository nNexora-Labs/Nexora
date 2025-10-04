# Security Guidelines

## Environment Variables

**⚠️ CRITICAL: Never commit API keys or secrets to the repository!**

### Required Environment Variables

Copy `.env.example` to `.env.local` and fill in your actual values:

```bash
cp webapp/.env.example webapp/.env.local
```

### Essential Variables:

1. **RPC URLs** (choose one or both for redundancy):
   ```bash
   # Infura (recommended)
   NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
   
   # Alchemy (alternative)
   NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
   ```

2. **Contract Addresses** (updated automatically on deployment):
   ```bash
   NEXT_PUBLIC_CWETH_ADDRESS=0xaF74dA9526B64E78e6C5DdC56FC7030667A4fe94
   NEXT_PUBLIC_VAULT_ADDRESS=0x10583bFbcA32c12d1Ab30e9f8Aae22F374796b67
   ```

### Security Best Practices:

- ✅ Always use environment variables for API keys
- ✅ Keep `.env.local` in `.gitignore`
- ✅ Use `.env.example` as a template
- ✅ Never hardcode secrets in source code
- ✅ Use different keys for development/production

### Getting API Keys:

1. **Infura**: https://infura.io/ (Free tier available)
2. **Alchemy**: https://alchemy.com/ (Free tier available)
3. **Etherscan**: https://etherscan.io/apis (Free tier available)
