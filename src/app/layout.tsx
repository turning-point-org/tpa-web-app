import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import Image from "next/image";
import UserProfile from "../components/UserProfile";
import TenantSwitcher from "../components/TenantSwitcher";
import Breadcrumbs from "../components/Breadcrumbs";

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]`}
      >
        <UserProvider loginUrl="/api/auth/login" profileUrl="/api/auth/me">
          <aside className="fixed top-0 left-0 w-80 h-screen flex flex-col bg-[var(--color-secondary)] border-r border-[var(--color-border)] p-6 shadow-sm z-[10]">
            <div>
              <Link href="/" className="block mb-10">
                <Image
                  src="/turning-point-logo.svg"
                  alt="TurningPoint Logo"
                  width={150}
                  height={40}
                  priority
                />
              </Link>
              <nav>
                <TenantSwitcher />
              </nav>
            </div>
            <div className="mt-auto">
              <UserProfile />
            </div>
          </aside>
          <main className="flex-grow pt-10 pl-5 pr-5 ml-80">
            <div className="w-full max-w-[1200px] mx-auto">
              <Breadcrumbs />
              {children}
            </div>
          </main>
        </UserProvider>
      </body>
    </html>
  );
}
