import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   experimental1: {
    turbo: {
      rules: {
        '*.css': {
          loaders: ['@tailwindcss/vite'],
        },
      },
    },
  },
 async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
  
  // Allow Adobe CDN scripts
  experimental: {
    serverComponentsExternalPackages: [],
  },
  
  // Webpack configuration for external resources
  webpack: (config, { isServer }) => {
    // Allow external Adobe scripts
    config.externals = [...(config.externals || [])];
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
  
  // Enable images from Adobe CDN
  images: {
    domains: ['documentservices.adobe.com'],
  },
  
};

export default nextConfig;
