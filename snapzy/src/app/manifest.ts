import type { MetadataRoute } from "next";

// Lets phones "Add to Home Screen" with the Snapzy icon and colors.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Snapzy",
    short_name: "Snapzy",
    description: "AI screenshot sorter and picture organizer.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f1f4f8",
    theme_color: "#5b74d3",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/snapzy-icon-1024.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
    ],
  };
}
