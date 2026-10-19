import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/ui/AppShell";
import { DemoUserProvider } from "@/lib/session";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ui/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SAMARTH — System for Accessible Management, Action, Resolution and Tracking of Hearings",
    template: "%s — SAMARTH",
  },
  description:
    "Official portal for accessible management, action, resolution, and tracking of public grievances and hearings.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-ink-900 selection:bg-primary-100 selection:text-primary-900">
        <DemoUserProvider>
          <I18nProvider><ToastProvider><AppShell>{children}</AppShell></ToastProvider></I18nProvider>
        </DemoUserProvider>
      </body>
    </html>
  );
}
