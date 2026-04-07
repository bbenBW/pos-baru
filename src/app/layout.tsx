import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OfflineIndicator } from "@/components/shared/OfflineIndicator";
import { SyncStatusToast } from "@/components/shared/SyncStatusToast";
import { ClientShell } from "@/components/shared/ClientShell";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>
        <OfflineIndicator />
        <SyncStatusToast />
        <ClientShell>
          {children}
        </ClientShell>
      </body>
    </html>
  );
}
