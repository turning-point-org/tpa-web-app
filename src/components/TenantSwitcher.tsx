"use client";

import React, { useState } from "react";
import Image from "next/image";

export default function TenantSwitcher() {
  const tenants = [
    "Tenant A",
    "Tenant B",
    "Tenant C",
    "Tenant D",
    // Add more tenants to test scrolling if needed
  ];
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(tenants[0]);

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleSelectTenant = (tenant: string) => {
    setSelectedTenant(tenant);
    setIsOpen(false);
  };

  return (
    <div className="mt-6">
      {/* Collapsed Header */}
      <div
        className="flex items-center justify-between p-4 border border-gray-300 rounded-lg bg-white cursor-pointer"
        onClick={toggleOpen}
      >
        <div className="flex items-center space-x-3">
          {/* Tenant icon */}
          <Image
            src="/tenant-icon.png"
            alt="Tenant Icon"
            width={30}
            height={30}
            className="rounded"
          />
          <span className="text-gray-700 font-semibold">{selectedTenant}</span>
        </div>
        {/* Arrow indicator */}
        <span className="text-gray-500">{isOpen ? "▲" : "▼"}</span>
      </div>

      {/* Expanded Content */}
      <div
        className={`
          overflow-hidden rounded-lg mt-2 
          ${isOpen ? "min-h-[200px] max-h-[400px] p-4 bg-white" : "max-h-0 p-0 bg-transparent"}
        `}
      >
        {isOpen && (
          <div className="flex flex-col h-full">
            {/* Tenant list container with scrolling if needed */}
            <div className="flex-grow overflow-y-auto">
              <ul className="space-y-2">
                {tenants.map((tenant) => (
                  <li
                    key={tenant}
                    className="text-gray-600 hover:bg-gray-100 p-2 rounded cursor-pointer"
                    onClick={() => handleSelectTenant(tenant)}
                  >
                    {tenant}
                  </li>
                ))}
              </ul>
            </div>
            <button className="mt-2 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 cursor-pointer">
              Create New Tenant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
