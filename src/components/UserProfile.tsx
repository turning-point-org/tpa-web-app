/* eslint-disable */
"use client";

import React, { useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import Image from "next/image";

interface UserProfileProps {
  isCollapsed?: boolean;
}

export default function UserProfile({ isCollapsed = false }: UserProfileProps) {
  const { user, error, isLoading } = useUser();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (isLoading)
    return (
      <div className={`bg-gray-800 text-white border border-gray-700 rounded-lg p-4 ${isCollapsed ? 'w-16' : 'w-[250px]'}`}>
        {!isCollapsed && "Loading..."}
      </div>
    );
  if (error)
    return (
      <div className={`bg-gray-800 text-white border border-gray-700 rounded-lg p-4 ${isCollapsed ? 'w-16' : 'w-[250px]'}`}>
        {!isCollapsed && `Error: ${error?.message}`}
      </div>
    );

  if (user) {
    const imageSrc = user.picture || "/user-icon.png";
    const email = user.email || "";
    const emailDisplay =
      email.length > 25 ? email.substring(0, 25) + "..." : email;
    return (
      <div className={`relative inline-block ${isCollapsed ? 'w-16 flex justify-center' : 'w-[270px]'}`}>
        {/* Main Card */}
        <div 
          className={`bg-gray-200 text-black rounded-lg p-3 cursor-pointer ${isCollapsed ? 'flex justify-center' : ''}`}
          onMouseEnter={() => setIsDropdownOpen(true)}
          onMouseLeave={() => setIsDropdownOpen(false)}
        >
          <div className={`relative ${isCollapsed ? '' : 'flex items-center space-x-2'}`}>
            <Image
              src={imageSrc}
              alt="User Image"
              width={30}
              height={30}
              className="rounded-full"
            />
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-sm text-gray-800">{emailDisplay}</span>
              </div>
            )}
            
            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute left-0 bottom-full mb-2 z-50 w-64">
                <div className="bg-white text-black rounded-lg shadow-lg p-2">
                  <ul className="divide-y divide-gray-200">
                    <li>
                      <Link href="/profile">
                        <span className="block px-4 py-2 hover:bg-gray-100 cursor-pointer">
                          Profile
                        </span>
                      </Link>
                    </li>
                    <li>
                      <Link href="/documentation">
                        <span className="block px-4 py-2 hover:bg-gray-100 cursor-pointer">
                          Documentation
                        </span>
                      </Link>
                    </li>
                    <li>
                      <Link href="/support">
                        <span className="block px-4 py-2 hover:bg-gray-100 cursor-pointer">
                          Support
                        </span>
                      </Link>
                    </li>
                  </ul>
                  <div className="mt-2">
                    <a href="/api/auth/logout">
                      <button className="w-full text-left px-4 py-2 bg-gray-200 hover:bg-gray-100 rounded text-sm cursor-pointer">
                        Logout
                      </button>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } else {
    // This case should not occur in practice since AuthWrapper will handle unauthenticated users
    return (
      <div className={`bg-gray-800 text-white border border-gray-700 rounded-lg p-4 ${isCollapsed ? 'w-16' : 'w-[250px]'}`}>
        {!isCollapsed && "Not logged in"}
      </div>
    );
  }
}
