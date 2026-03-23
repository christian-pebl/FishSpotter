import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PEBL FishSpotter",
    short_name: "PEBL Spotter",
    description: "Protecting Ecology Beyond Land through playful marine monitoring, short-form underwater clips, and community spotting.",
    start_url: "/",
    display: "standalone",
    background_color: "#DEF2F1",
    theme_color: "#2B7A78",
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
