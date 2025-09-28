/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static exports for better performance
  output: 'standalone',
  
  // Optimize for production
  swcMinify: true,
  
  // Enable experimental features for better performance
  experimental: {
    optimizeCss: true,
  },
  
  // Image optimization
  images: {
    domains: ['localhost'],
    unoptimized: true, // For static exports
  },
  

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  webpack: (config, { isServer, webpack }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
    };

    // Add global polyfill for browser environment
    if (!isServer) {
      config.resolve.fallback.global = false;
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.DefinePlugin({
          global: 'globalThis',
        })
      );
    }
    
    // Ignore React Native dependencies
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };

    // Handle circular dependencies in Zama Relayer SDK
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          zama: {
            test: /[\\/]node_modules[\\/]@zama-fhe[\\/]/,
            name: 'zama',
            chunks: 'all',
            priority: 20,
            enforce: true,
          },
        },
      },
    };

    // Ignore circular dependency warnings for Zama SDK
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/@zama-fhe\/relayer-sdk/,
        message: /Circular dependency/,
      },
      {
        module: /workerHelpers/,
        message: /Circular dependency/,
      },
    ];

    // Only apply client-side optimizations
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Force web version of Zama SDK
        '@zama-fhe/relayer-sdk': '@zama-fhe/relayer-sdk/web',
      };
    }
    
    return config;
  },
}

module.exports = nextConfig
