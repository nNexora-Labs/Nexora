/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use standalone output if VERCEL_DEPLOYMENT is set
  ...(process.env.VERCEL_DEPLOYMENT === 'true' && {
    output: 'standalone',
    outputFileTracingRoot: require('path').join(__dirname, '../'),
  }),
  
  /* // Enable experimental features for better performance
  experimental: {
    optimizeCss: true,
    // Add this for faster dev builds
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },  */
  
  // Development optimizations
  ...(process.env.NODE_ENV === 'development' && {
    typescript: {
      ignoreBuildErrors: true, // Skip TS errors in dev for faster builds
    },
    eslint: {
      ignoreDuringBuilds: true, // Skip ESLint in dev for faster builds
    },
  }),
  

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
      // Ensure CSS files have correct MIME type
      {
        source: '/_next/static/css/(.*)',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/css',
          },
        ],
      },
    ];
  },
  
  webpack: (config, { isServer, webpack, dev }) => {
    // Development optimizations
    if (dev) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
    }

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
