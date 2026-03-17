/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/monitor/:path*',
        destination: 'http://localhost:3001/:path*',
      },
      {
        source: '/api/rag/:path*',
        destination: 'http://localhost:3004/api/:path*',
      },
    ];
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM http://localhost:3000',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' http://localhost:3000",
          },
        ],
      },
    ];
  },
}
module.exports = nextConfig
