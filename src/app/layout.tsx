import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { ModeSwitch } from "@/components/topbar";
import { getMode, countPlatformConnections } from "@/lib/connections/mode";
import { getConnections } from "@/lib/connections/store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial news serif for page titles. Newsreader reads as reporting/press
// (fits a media-buying tool) and avoids the overused Fraunces display-serif tell.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const title = "Media Buying OS";
const description =
  "AI-first media buying command center: cross-platform reporting, competitor ad intelligence, and safe automations for teams buying at scale on Google, Meta, Taboola, and TikTok.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: title,
  openGraph: {
    title,
    description,
    siteName: title,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const mode = await getMode();
  const connectedCount = countPlatformConnections(await getConnections());

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="grain" aria-hidden />
        <div className="relative flex min-h-dvh">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <ModeSwitch mode={mode} connectedCount={connectedCount} />
            <main className="min-w-0 flex-1 px-4 py-6 pb-20 sm:px-8 md:pb-6">
              <div className="mx-auto max-w-7xl">{children}</div>
            </main>
          </div>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
