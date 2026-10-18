import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@calender/shared"],
  // Keep the dev badge off the sidebar's account row.
  devIndicators: { position: "bottom-right" },
  // Resolve "@/..." here as well as in tsconfig.json, so imports don't depend on
  // Next.js finding and parsing the TypeScript config in the build environment.
  webpack(config) {
    config.resolve.alias["@"] = fileURLToPath(new URL(".", import.meta.url));
    return config;
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Nothing here should be embedded in someone else's page.
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
