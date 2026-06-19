import type { Metadata } from "next";
import { Inter, Madimi_One } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const musimiOne = Madimi_One({
  variable: "--font-madimi",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Med+Inv",
  description: "Sistema de gestión de inventario para farmacias",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-theme="boticario"
      data-density="comfortable"
      className={`${inter.variable} ${musimiOne.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
