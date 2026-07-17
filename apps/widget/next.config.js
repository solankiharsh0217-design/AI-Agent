/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    // NOTE: This is an embeddable widget. It must be framable on ANY customer
    // site, so we intentionally do NOT send X-Frame-Options (deprecated, cannot
    // express multiple origins) and use `frame-ancestors *`. The real security
    // gate is the per-widget API CORS/domain allow-list + widget token, not the
    // static iframe shell. `microphone=(self)` + the iframe `allow="microphone"`
    // (set in public/embed.js) are required for the voice agent to work.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: data: https:; connect-src 'self' https: wss:;" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
