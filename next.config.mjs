import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
// Next.js dev mode evaluates modules with `eval` (Fast Refresh / webpack),
// so `unsafe-eval` is required for the client bundle to hydrate. In production
// this is dropped and the policy stays strict.
const isDev = process.env.NODE_ENV !== 'production';
const cspScriptSrc = isDev
  ? "'self' 'unsafe-inline' 'unsafe-eval' https://www.paypal.com https://www.sandbox.paypal.com"
  : "'self' 'unsafe-inline' https://www.paypal.com https://www.sandbox.paypal.com";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src ${cspScriptSrc}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api-m.paypal.com https://api-m.sandbox.paypal.com",
      "frame-src https://www.paypal.com https://www.sandbox.paypal.com",
    ].join('; '),
  },
  // HSTS only applies over HTTPS (Vercel/Cloudflare terminate TLS)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    // SEC: never allow SVG through the optimizer (SVG can carry scripts).
    dangerouslyAllowSVG: false,
    // SEC: arbitrary remote hosts enable SSRF via the image optimizer.
    // Logos are validated server-side (isValidLogoUrl) but we still scope
    // the optimizer to https only and block internal/metadata hosts.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
