import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Media Buying OS",
  description:
    "AI-first media buying command center: cross-platform reporting, competitor ad intelligence, and safe automations for teams buying at scale on Google, Meta, Taboola, and TikTok.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-dvh">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 py-6 pb-20 sm:px-8 md:pb-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
