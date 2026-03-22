import type { Metadata } from "next";
import { SessionProvider } from "@/components/SessionProvider";
import { Header } from "@/components/Header";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "FishSpotter – What’s that creature?",
  description: "Watch short clips from local waters and guess the creature. Learn and compete with the community.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased h-screen flex flex-col overflow-hidden">
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
