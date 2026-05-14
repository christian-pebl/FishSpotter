import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import { SessionProvider } from "@/components/SessionProvider";
import { Header } from "@/components/Header";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${roboto.className} antialiased h-[100dvh] flex flex-col overflow-hidden`}>
        <a href="#main" className="skip-link">Skip to main content</a>
        <SessionProvider>
          <PwaRegister />
          <Header />
          <div className="flex-1 flex flex-col min-h-0">
            {children}
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
