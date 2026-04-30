import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Calender",
    short_name: "Calender",
    description: "Personal calendar with synced reminders and iPhone Live Activity countdowns.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f0e8",
    theme_color: "#1f3d36",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
