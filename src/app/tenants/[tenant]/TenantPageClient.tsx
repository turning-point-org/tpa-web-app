"use client";

import React, { useState } from "react";
import { useUser } from '@auth0/nextjs-auth0/client';
import Button from "@/components/Button";
import UserManagementModal from "@/components/UserManagementModal";
import { Tenant } from "@/types";

interface TenantPageClientProps {
  tenant: Tenant;
}

export default function TenantPageClient({ tenant }: TenantPageClientProps) {
  const { user } = useUser();
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // Check if user is admin (has @turningpointadvisory.com.au email)
  const isAdmin = (
    user?.email?.endsWith('@turningpointadvisory.com.au') ||
    user?.email?.endsWith('@novigi.com.au')
  ) ?? false;

  if (!isAdmin) {
    return null; // Don't show anything if user is not admin
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-end">
          <Button
            onClick={() => setIsUserModalOpen(true)}
            variant="secondary"
          >
            Manage Users
          </Button>
        </div>
      </div>

      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        tenantId={tenant.tenant_id}
        tenantName={tenant.name}
      />
    </>
  );
}
