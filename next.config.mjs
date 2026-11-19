/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The stylesheet is small: inline it so it does not block the first paint.
  experimental: { inlineCss: true },
  images: { formats: ['image/avif', 'image/webp'], deviceSizes: [390, 640, 828, 1080, 1280, 1920] }
};

export default nextConfig;
