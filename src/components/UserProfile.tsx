"use client";

import React from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import Image from "next/image";

export default function UserProfile() {
  const { user, error, isLoading } = useUser();

  if (isLoading)
    return (
      <div className="bg-gray-800 text-white border border-gray-700 rounded-lg p-4 w-[250px]">
        Loading...
      </div>
    );
  if (error)
    return (
      <div className="bg-gray-800 text-white border border-gray-700 rounded-lg p-4 w-[250px]">
        Error: {error?.message}
      </div>
    );

  if (user) {
    const imageSrc = user.picture || "/user-icon.png";
    const email = user.email || "";
    const emailDisplay =
      email.length > 25 ? email.substring(0, 25) + "..." : email;
    return (
      <div className="group relative inline-block w-[270px]">
        {/* Main Card */}
        <div className="bg-gray-200 text-black rounded-lg p-3 overflow-hidden cursor-pointer">
          <div className="flex items-center space-x-2">
            <Image
              src={imageSrc}
              alt="User Image"
              width={30}
              height={30}
              className="rounded-full"
            />
            <div className="flex flex-col">
              <span className="text-sm text-gray-800">{emailDisplay}</span>
            </div>
          </div>
        </div>
        {/* Dropdown Menu */}
        <div className="absolute left-0 right-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <div className="bg-white text-black rounded-lg shadow-lg p-2">
            <ul className="divide-y divide-gray-200">
              <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Account</li>
              <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Documentation</li>
              <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Support</li>
            </ul>
            <div className="mt-2">
              <Link href="/api/auth/logout">
                <button className="w-full text-left px-4 py-2 bg-gray-200 hover:bg-gray-100 rounded text-sm cursor-pointer">
                  Logout
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    // Full screen takeover for not logged in state
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
        <Image
          src="/turning-point-logo.svg"
          alt="TurningPoint Logo"
          width={150}
          height={150}
          className="mb-4"
        />
        <h1 className="text-2xl font-bold mb-2">Welcome to TurningPoint</h1>
        <p className="text-gray-700 mb-4">Please log in to continue</p>
        <Link href="/api/auth/login">
          <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 transition rounded text-white cursor-pointer">
            Login
          </button>
        </Link>
      </div>
    );
  }
}
