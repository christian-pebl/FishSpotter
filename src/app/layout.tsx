import type { Metadata, Viewport } from "next";
import { Jost, Roboto } from "next/font/google";
import { SessionProvider } from "@/components/SessionProvider";
import { Header } from "@/components/Header";
import { CookieBanner } from "@/components/legal/CookieBanner";
import { PwaRegister } from "@/components/PwaRegister";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { readConsent } from "@/lib/cookies/consent";
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

export const metadata: Metadata = {
  title: { default: "PEBL FishSpotter", template: "%s · PEBL FishSpotter" },
  description: "Protecting Ecology Beyond Land through playful marine monitoring, community spotting, and short-form underwater clips.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b7a78",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  initialScale: 1,
  width: "device-width",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const consent = await readConsent();
  return (
    <html lang="en" className={`${jost.variable} ${roboto.variable}`}>
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
          <PwaRegister />
          <Header />
          <div className="flex-1 flex flex-col min-h-0">
            {children}
          </div>
          <CookieBanner initiallyDismissed={!!consent} />
          <WebVitalsReporter />
        </SessionProvider>
      </body>
    </html>
  );
}
