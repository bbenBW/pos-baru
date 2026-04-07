import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { OfflineIndicator } from "@/components/shared/OfflineIndicator";
import { SyncStatusToast } from "@/components/shared/SyncStatusToast";
import { ClientShell } from "@/components/shared/ClientShell";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ERP & POS Bangunan",
  description: "Aplikasi Kasir dan ERP untuk Toko Bangunan",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Client components will be checked next
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${geistSans.className} bg-slate-50 text-slate-900`}>
        <OfflineIndicator />
        <SyncStatusToast />
        <ClientShell>
          {children}
        </ClientShell>
      </body>
    </html>
  );
}
