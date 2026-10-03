import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { DemoUserProvider } from "@/lib/session";

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
    default: "GrievAI — National Grievance Redressal Portal",
    template: "%s — GrievAI",
  },
  description:
    "Official portal to register, track, and resolve public grievances with AI-assisted categorization and prioritization.",
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
          <SiteHeader />
          <main className="flex-1 bg-white">{children}</main>
          <SiteFooter />
        </DemoUserProvider>
      </body>
    </html>
  );
}
