import { SITE_URL } from "@/lib/site-url";
import type { Metadata, Viewport } from "next";
import { Jost, Roboto } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import { SessionProvider } from "@/components/SessionProvider";
import { Header } from "@/components/Header";
import { CookieBanner } from "@/components/legal/CookieBanner";
import { PwaRegister } from "@/components/PwaRegister";
import { LandingAttribution } from "@/components/LandingAttribution";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { AgeCheck } from "@/components/age/AgeCheck";
import { AskParentDialog } from "@/components/parent/AskParentDialog";
import "./globals.css";

const jost = Jost({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

// Super Water (DaFont, fsuarez913), a rounded bubble cartoon face, free for
// commercial use. Used only for the "FishSpotter" brand wordmark in the header,
// so it's exposed as its own display variable.
//
// The file shipped is a subset holding just the wordmark's ten letters
// (F S e h i o p r s t): 4.5 KB where the full TTF was 97 KB (52 KB on the
// wire), preloaded on every page. Same outlines, hinting, kerning and metrics.
// The display font class must therefore style nothing but the wordmark, which
// src/components/wordmark-font.test.ts enforces. To use the face for other
// text, regenerate from the full font, which stays beside it as the source:
//   python -m fontTools.subset src/app/fonts/SuperWater.ttf
//     --text="<letters>" --flavor=woff2 --layout-features="*"
//     --output-file=src/app/fonts/SuperWater-wordmark.woff2
const superWater = localFont({
  src: "./fonts/SuperWater-wordmark.woff2",
  variable: "--font-display",
  display: "swap",
});

const SITE_TITLE = "PEBL FishSpotter";
const SITE_DESCRIPTION =
  "Protecting Ecology Beyond Land through playful marine monitoring, community spotting, and short-form underwater clips.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Names the real domain as the one true address of every page. Without it,
  // the app is reachable on both fishspotter.app and the Vercel host with no
  // statement about which is which, so search engines are left to guess between
  // two identical sites. Relative, so each route canonicalises to itself.
  alternates: { canonical: "./" },
  title: { default: SITE_TITLE, template: "%s · PEBL FishSpotter" },
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.svg",
  },
  // Default share preview. The 1200x630 card comes from opengraph-image.tsx,
  // which Next wires onto both openGraph and twitter automatically, so no
  // explicit image reference is needed here.
  openGraph: {
    type: "website",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#2b7a78",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  initialScale: 1,
  width: "device-width",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jost.variable} ${roboto.variable} ${superWater.variable}`}>
      <head>
        {/*
          Species reference photos load as plain <img> straight from the
          iNaturalist / Wikimedia hosts (next/image can't optimize them because
          the per-photo origin id changes on each cron refresh). Preconnecting
          warms the TLS/DNS handshake to the two hosts that serve the bulk of
          our cached photos, shaving the round-trip off the first image paint.
          No crossOrigin: plain <img> requests are not CORS, so the hint must
          match the anonymous connection or it won't be reused.
        */}
        {/*
          R2 first: once Route C has transcoded a species photo, its WebP is
          served from our own bucket, so this is the host the galleries/marquee
          hit. The iNat hosts remain the fallback for not-yet-transcoded rows.
        */}
        <link rel="preconnect" href="https://pub-b0fda9a751144df59165871565716de4.r2.dev" />
        <link rel="preconnect" href="https://inaturalist-open-data.s3.amazonaws.com" />
        <link rel="preconnect" href="https://www.inaturalist.org" />
        <link rel="dns-prefetch" href="https://upload.wikimedia.org" />
      </head>
      <body className="font-body antialiased h-[100dvh] flex flex-col overflow-hidden">
        <a href="#main" className="skip-link">Skip to main content</a>
        <SessionProvider>
          <LandingAttribution />
          <PwaRegister />
          <Header />
          <div className="flex-1 flex flex-col min-h-0">
            {children}
          </div>
          <CookieBanner />
          {/* Children's Code and COPPA: the one age question, and the one
              "ask a parent or carer" dialog, for the whole app. */}
          <AgeCheck />
          <AskParentDialog />
          <WebVitalsReporter />
          <Analytics />
        </SessionProvider>
      </body>
    </html>
  );
}
