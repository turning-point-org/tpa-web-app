"use client";

import React from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import Image from "next/image";
import Button from "./Button";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, error, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
        <div className="flex flex-col items-center justify-center">
          <Image
            src="/turning-point-logo.svg"
            alt="TurningPoint Logo"
            width={150}
            height={150}
            className="mb-4"
          />
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
        <div className="flex flex-col items-center justify-center">
          <Image
            src="/turning-point-logo.svg"
            alt="TurningPoint Logo"
            width={150}
            height={150}
            className="mb-4"
          />
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-red-500 mb-4">{error.message}</p>
          <a href="/api/auth/login">
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 transition rounded text-white cursor-pointer">
              Try Again
            </button>
          </a>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
        <div className="flex flex-col items-center justify-center">
          <Image
            src="/turning-point-logo.svg"
            alt="TurningPoint Logo"
            width={150}
            height={150}
            className="mb-4"
          />
          <h1 className="text-2xl font-bold mb-2">Welcome to TurningPoint</h1>
          <p className="text-gray-700 mb-4">Please log in to continue</p>
          <a href="/api/auth/login">
            <Button>
              Login
            </Button>
          </a>
        </div>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
} 