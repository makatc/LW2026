/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@lwbeta/ui', '@lwbeta/utils'],
    async rewrites() {
        return [
            {
                source: '/api/monitor/:path*',
                destination: 'http://localhost:3001/:path*',
            },
            {
                source: '/api/comparator/:path*',
                destination: 'http://localhost:3002/:path*',
            },
        ];
    },
};

module.exports = nextConfig;
