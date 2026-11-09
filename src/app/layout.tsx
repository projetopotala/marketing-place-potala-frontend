import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const potalaSerif = Cormorant_Garamond({
  variable: "--font-potala-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const potalaSans = Manrope({
  variable: "--font-potala-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Instituto Potala Marketplace",
  description:
    "Produtos, cursos e experiências para bem-estar, aprendizado, cura e expansão espiritual.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${potalaSans.variable} ${potalaSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-potala-bg font-sans text-potala-text">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
