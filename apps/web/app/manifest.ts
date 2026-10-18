import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Remindly",
    short_name: "Remindly",
    description: "Personal calendar with synced reminders and iPhone Live Activity countdowns.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f1ec",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // The mark sits well inside the square, so platforms that crop to their own shape can use it too.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
