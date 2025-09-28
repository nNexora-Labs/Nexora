# Confidential Lending Frontend - Vercel Deployment

This is a Next.js application for confidential lending built with FHEVM and deployed on Vercel.

## 🚀 Quick Deploy to Vercel

### Option 1: Deploy with Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from the project root**:
   ```bash
   vercel
   ```

4. **Follow the prompts**:
   - Link to existing project? → No
   - Project name → confidential-lending-frontend (or your preferred name)
   - Directory → webapp
   - Override settings? → No

### Option 2: Deploy via Vercel Dashboard

1. **Push your code to GitHub** (if not already done)
2. **Go to [vercel.com](https://vercel.com)**
3. **Click "New Project"**
4. **Import your GitHub repository**
5. **Configure the project**:
   - Framework Preset: Next.js
   - Root Directory: webapp
   - Build Command: `npm run build`
   - Output Directory: `.next`
6. **Click "Deploy"**

## 🔧 Configuration

### Environment Variables

Set these in your Vercel dashboard under Project Settings → Environment Variables:

```
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS=YOUR_CONTRACT_ADDRESS
```

### Build Settings

The project is configured with:
- **Framework**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

## 📁 Project Structure

```
├── webapp/                 # Next.js application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Next.js pages
│   │   └── utils/          # Utility functions
│   ├── public/             # Static assets
│   ├── package.json        # Dependencies
│   └── next.config.js      # Next.js configuration
├── contracts/              # Smart contracts (not deployed)
├── vercel.json             # Vercel configuration
└── .vercelignore           # Files to ignore during deployment
```

## 🛠️ Local Development

1. **Install dependencies**:
   ```bash
   cd webapp
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. **Open [http://localhost:3000](http://localhost:3000)**

## 🔒 Security Features

The application includes:
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- **Environment Variable Protection**: Sensitive data not exposed to client
- **FHEVM Integration**: Fully homomorphic encryption for privacy

## 📊 Performance Optimizations

- **SWC Minification**: Faster builds and smaller bundles
- **CSS Optimization**: Experimental CSS optimization enabled
- **Code Splitting**: Automatic code splitting for better performance
- **Image Optimization**: Optimized image loading

## 🐛 Troubleshooting

### Common Issues:

1. **Build Failures**:
   - Check that all dependencies are in `package.json`
   - Ensure Node.js version is 18+ (Vercel requirement)

2. **Environment Variables**:
   - Make sure all required env vars are set in Vercel dashboard
   - Variables must start with `NEXT_PUBLIC_` to be available in browser

3. **FHEVM Issues**:
   - Ensure Zama Relayer SDK is properly configured
   - Check that webpack fallbacks are working

### Support:

- Check Vercel deployment logs in the dashboard
- Review Next.js build output for errors
- Ensure all dependencies are compatible with Node.js 18+

## 🚀 Production Deployment

Once deployed, your app will be available at:
`https://your-project-name.vercel.app`

The deployment includes:
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Automatic scaling
- ✅ Zero-downtime deployments
- ✅ Preview deployments for branches