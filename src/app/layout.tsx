import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { BRAND, ORGANIZATION, ATTRIBUTION } from "@/lib/brand";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const TITLE = `${BRAND.name} — Náhuatl: escucha y pronunciación`;

export const metadata: Metadata = {
  title: TITLE,
  description: `${BRAND.description} ${ATTRIBUTION.short}`,
  keywords: [
    "Axiom",
    "náhuatl",
    "pronunciación",
    "comprensión auditiva",
    "escucha",
    "fonética",
    "IA",
    "México",
    "lenguas originarias",
    "EdTech",
  ],
  authors: [{ name: ORGANIZATION.name }],
  applicationName: BRAND.name,
  openGraph: {
    title: TITLE,
    description: `${BRAND.description} ${ATTRIBUTION.short}`,
    url: "https://axiom.mx",
    siteName: BRAND.name,
    type: "website",
    locale: "es_MX",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: BRAND.description,
  },
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Material Symbols Outlined (iconography) */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body
        className={`${lexend.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: "'Lexend', sans-serif" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
