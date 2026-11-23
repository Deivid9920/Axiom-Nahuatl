import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"; // R24: sonner — todo el código de la app llama toast() de sonner; el Toaster de Radix dejaba cada notificación en no-op silencioso

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Axiom — Aprende inglés dentro de tu trabajo",
  description: "Plataforma de aprendizaje de inglés con IA para profesionales mexicanos. RAG con tus propios documentos, IRT 3PL, FSRS, DeepSeek V4.",
  keywords: ["Axiom", "inglés", "IA", "RAG", "profesionales", "México", "nearshoring", "DeepSeek", "EdTech"],
  authors: [{ name: "Equipo Axiom" }],
  openGraph: {
    title: "Axiom — Aprende inglés dentro de tu trabajo",
    description: "Plataforma de IA para profesionales mexicanos. RAG con tus documentos, IRT 3PL + FSRS, DeepSeek V4.",
    url: "https://axiom.mx",
    siteName: "Axiom",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Axiom — Aprende inglés dentro de tu trabajo",
    description: "Plataforma de IA para profesionales mexicanos.",
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
