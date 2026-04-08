/** @type {import('next').NextConfig} */

const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if ESLint errors exist, since we don't use ESLint.
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: "/app/:path*",
        destination: "/navigator/:path*",
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/index.html",
        destination: "/",
        permanent: false,
      },
      {
        source: "/navigator/:path*",
        destination: "/app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
