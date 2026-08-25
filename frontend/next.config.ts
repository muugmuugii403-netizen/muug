import type { NextConfig } from "next";

/**
 * Next.js 15 тохиргоо.
 * - reactStrictMode: давхар mount-ийг илрүүлж, effect-ийг цэвэр байлгана
 * - poweredByHeader: false — X-Powered-By header-ийг нууж fingerprinting бууруулна
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
