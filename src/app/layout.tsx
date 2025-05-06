import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import AuthWrapper from "../components/AuthWrapper";
import { ScanContextProvider } from "../components/ScanContextProvider";
import ClientLayout from "../components/ClientLayout";

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
        <UserProvider 
          loginUrl="/api/auth/login" 
          profileUrl="/api/auth/me"
        >
          <AuthWrapper>
            <ScanContextProvider>
              <ClientLayout>
                {children}
              </ClientLayout>
            </ScanContextProvider>
          </AuthWrapper>
        </UserProvider>
      </body>
    </html>
  );
}
