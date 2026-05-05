import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Taxi Accounting System",
  description: "Simple and professional taxi accounting dashboard",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=1", type: "image/x-icon", sizes: "any" },
      { url: "/logo.jpeg?v=2", type: "image/jpeg" },
      { url: "/logo.jpeg?v=2", rel: "shortcut icon", type: "image/jpeg" },
    ],
    apple: [{ url: "/logo.jpeg?v=2", type: "image/jpeg" }],
    shortcut: ["/favicon.ico?v=1"],
  },
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
