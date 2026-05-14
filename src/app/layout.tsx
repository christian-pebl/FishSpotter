import type { Metadata } from "next";
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
  themeColor: "#2b7a78",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${roboto.className} antialiased h-screen flex flex-col overflow-hidden`}>
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
