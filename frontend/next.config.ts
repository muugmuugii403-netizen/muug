import type { NextConfig } from "next";

/**
 * Next.js 15 тохиргоо.
 * - reactStrictMode: давхар mount-ийг илрүүлж, effect-ийг цэвэр байлгана
 * - poweredByHeader: false — X-Powered-By header-ийг нууж fingerprinting бууруулна
 * - headers(): production-д нэмэлт security header-үүд (Step 8)
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
