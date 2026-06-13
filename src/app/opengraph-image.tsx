import { ImageResponse } from "next/og";

// Default social-share card (1200x630) used for any route without its own
// opengraph-image. Next reuses this for Twitter as well, so no separate
// twitter-image file is required. Brand: dark navy ground, teal accent.
export const alt = "PEBL FishSpotter: spot the species in UK marine monitoring clips";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#17252A";
const TEAL = "#3AAFA9";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: NAVY,
          padding: "80px 96px",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 30,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: TEAL,
            fontWeight: 600,
          }}
        >
          PEBL CIC
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 132,
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1,
          }}
        >
          FishSpotter
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 44,
            fontWeight: 400,
            color: "#DEF2F1",
            maxWidth: 900,
            lineHeight: 1.25,
          }}
        >
          Spot the species in UK marine monitoring clips
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 56,
            width: 220,
            height: 10,
            borderRadius: 5,
            backgroundColor: TEAL,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
