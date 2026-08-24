import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import MetaPixel from "@/components/MetaPixel";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallProvider";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://catalog.almatytovar.kz"),
  title: "Алматы Товар — каталог хозтоваров",
  description: "B2B каталог для оптовых заказов хозтоваров с ценами с НДС",
  alternates: { canonical: "https://catalog.almatytovar.kz" },
  openGraph: {
    type: "website",
    locale: "ru_KZ",
    siteName: "Almaty.tovar",
    title: "Алматы Товар — каталог хозтоваров",
    description: "B2B каталог для оптовых заказов хозтоваров с ценами с НДС",
    images: [{ url: "/company-logo-original.jpg", width: 1254, height: 1254, alt: "Almaty.tovar" }],
  },
  manifest: "/manifest.webmanifest",
  applicationName: "Алматы Товар",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Хозтовары",
  },
  icons: {
    icon: [
      { url: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#069a87",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <Script src="/pwa-boot.js" strategy="beforeInteractive" />
        <PwaInstallProvider>
          {children}
          <MetaPixel pixelId={process.env.META_PIXEL_ID || null} />
        </PwaInstallProvider>
      </body>
    </html>
  );
}
