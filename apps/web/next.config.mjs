/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@calender/shared"],
  // Keep the dev badge off the sidebar's account row.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
