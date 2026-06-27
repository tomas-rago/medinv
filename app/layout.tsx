import type { Metadata } from "next";
import { Inter, Madimi_One } from "next/font/google";
import "./globals.css";
import "@/lib/i18n/zod";
import { getMessages } from "next-intl/server";
import { IntlProvider } from "@/components/IntlProvider";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let messages = {};
  try {
    messages = await getMessages();
  } catch {
    // During build-time pre-rendering of error pages, request context is unavailable
  }

  return (
    <html
      lang="es"
      data-theme="boticario"
      data-density="comfortable"
      className={`${inter.variable} ${musimiOne.variable} h-full`}
    >
      <body className="min-h-full">
        <IntlProvider messages={messages}>
          {children}
        </IntlProvider>
      </body>
    </html>
  );
}
