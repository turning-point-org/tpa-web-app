import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import Breadcrumbs from "@/components/Breadcrumbs";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TurningPoint",
  description: "TurningPoint",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen bg-gray-100 text-[var(--color-foreground)]`}
      >
        <UserProvider loginUrl="/api/auth/login" profileUrl="/api/auth/me">
          <Sidebar />
          <main className="flex-grow ml-80 h-screen bg-gray-100">
            <div className="w-full mx-auto h-full scrollable">
              <Breadcrumbs />
              {children}
            </div>
          </main>
        </UserProvider>
      </body>
    </html>
  );
}
