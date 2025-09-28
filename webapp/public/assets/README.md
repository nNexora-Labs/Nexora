# Assets Folder Structure

This folder contains all static assets for the Nexora application.

## Folder Organization

### `/logos/`
- Brand logos (Nexora logo, partner logos, etc.)
- SVG format preferred for scalability
- Recommended sizes: 32x32, 64x64, 128x128, 256x256

### `/icons/`
- UI icons (navigation icons, action icons, etc.)
- SVG format preferred
- Material-UI compatible icons

### `/symbols/`
- Token symbols and cryptocurrency icons
- ETH, cWETH, and other token logos
- Recommended format: SVG or PNG with transparency

### `/images/`
- General images, backgrounds, illustrations
- Marketing images, screenshots, etc.
- Optimized formats: WebP, PNG, JPG

## Usage in Next.js

Access assets in your components using:

```jsx
// Logo example
<img src="/assets/logos/nexora-logo.svg" alt="Nexora Logo" />

// Token symbol example
<img src="/assets/symbols/eth.svg" alt="Ethereum" />
```

## File Naming Convention

- Use kebab-case: `nexora-logo.svg`
- Include size in filename when needed: `nexora-logo-64x64.svg`
- Use descriptive names: `wallet-connect-icon.svg`

## Optimization

- Compress images before adding
- Use appropriate formats (SVG for logos/icons, WebP for photos)
- Consider responsive image sizes
