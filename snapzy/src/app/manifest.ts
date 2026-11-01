import type { MetadataRoute } from "next";

// Lets phones "Add to Home Screen" with the Snapzy icon and colors.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Snapzy",
    short_name: "Snapzy",
    description: "AI screenshot sorter and picture organizer.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f1f4f8",
    theme_color: "#5b74d3",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/snapzy-icon-1024.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
    ],
    // Makes Snapzy appear in the phone's Share sheet for images (Android /
    // Chrome). The POST is handled by src/app/share-target/route.ts.
    // Next's type declares `files` as File[]; the real manifest format is a
    // list of { name, accept }.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        files: [{ name: "files", accept: ["image/*", ".heic", ".heif"] }],
      },
    } as unknown as MetadataRoute.Manifest["share_target"],
  };
}
