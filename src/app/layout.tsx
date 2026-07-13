import type { Metadata } from "next";
import { Bebas_Neue, Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { TmdbAttribution } from "@/components/tmdb-attribution";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";

// latin-ext added alongside latin - pt-BR text throughout the UI needs
// reliable glyph coverage for ã/õ/ç specifically, which latin alone doesn't
// guarantee across all three of these typefaces.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas-neue",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Kindred",
  description: "Search and browse movies and series.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <LanguageProvider>
          <AppHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <TmdbAttribution />
        </LanguageProvider>
      </body>
    </html>
  );
}
