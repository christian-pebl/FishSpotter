import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FishSpotter",
    short_name: "FishSpotter",
    description: "Watch short creature clips, make quick guesses, keep your streak alive, and climb the leaderboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#22d3ee",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml",
      },
    ],
  };
}
