"use client";

import React from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from '@/components/Button';
import Image from "next/image";

type WorkflowStep = {
  name: string;
  slug: string;
};

const WORKFLOW_STEPS: WorkflowStep[] = [
  { name: "Company Details", slug: "company-details" },
  { name: "Data Sources", slug: "data-sources" },
  { name: "Lifecycles", slug: "lifecycles" },
  { name: "Stakeholders", slug: "stakeholders" },
  { name: "Strategic Objectives", slug: "strategic-objectives" },
  { name: "Interview Copilot", slug: "interview-copilot" },
  { name: "Lifecycle Cost", slug: "lifecycle-cost" },
  { name: "Scenario Planning", slug: "scenario-planning" },
];

// Helper function to get base path and current step info
export function useWorkflowNavigation() {
  const pathname = usePathname();
  const pathParts = pathname.split("/");
  
  if (pathParts.length < 7) {
    return {
      basePath: "",
      currentStep: -1,
      scanId: ""
    };
  }
  
  const scanId = pathParts[6];
  const basePath = `${pathParts.slice(0, 6).join("/")}/${scanId}`;
  
  // Determine current step index
  let currentStep = -1;
  const currentSlug = pathParts[7];
  if (currentSlug) {
    currentStep = WORKFLOW_STEPS.findIndex(step => step.slug === currentSlug);
  }
  
  return {
    basePath,
    currentStep,
    scanId
  };
}

interface WorkflowNavProps {
  isSidebar?: boolean;
  scanData?: any;
  isCollapsed?: boolean; 
}

export default function WorkflowNav({ isSidebar = false, scanData = null, isCollapsed = false }: WorkflowNavProps) {
  const { basePath } = useWorkflowNavigation();
  const pathname = usePathname();
  
  if (!basePath) return null;

  return (
    <div>
      {isSidebar && scanData && !isCollapsed && (
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-700">
              {scanData.name}
            </h2>
            <span
              className={`px-2 py-1 text-xs rounded ${
                scanData.status === "done"
                  ? "bg-green-100 text-green-800"
                  : scanData.status === "active"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {scanData.status}
            </span>
          </div>
          {/* <p className="mt-1 text-xs text-gray-500">
            Created: {new Date(scanData.created_at).toLocaleString()}
          </p> */}
          {scanData.description && (
            <p className="mt-1 text-xs text-gray-500">
              {scanData.description}
            </p>
          )}
        </div>
      )}
      
      <nav className={`${isSidebar ? 'flex flex-col space-y-2' : 'flex overflow-x-auto pb-2'}`}>
        {WORKFLOW_STEPS.map((step) => {
          const href = `${basePath}/${step.slug}`;
          const isActive = pathname.includes(step.slug);
          
          return (
            <Link
              key={step.slug}
              href={href}
              className={`px-4 py-2 ${isSidebar ? 'w-full' : 'mx-1'} whitespace-nowrap rounded-md text-sm font-medium transition-colors flex items-center ${
                isActive
                  ? "bg-blue-100 text-blue-800"
                  : "text-gray-600 hover:bg-gray-100"
              } ${isCollapsed ? 'justify-center' : ''}`}
            >
              <div className={`relative flex items-center justify-center ${isCollapsed ? '' : 'mr-2'}`}>
                <div 
                  className={`rounded-full p-2 flex items-center justify-center relative`} 
                  style={{ 
                    backgroundColor: isActive ? "#7A2BF7" : "#ffffff",
                    border: "1px solid #E5E7EB",
                    width: "40px",
                    height: "40px"
                  }}
                >
                  <Image 
                    src={`/assets/icons/nav-icons/${step.slug}.svg`} 
                    alt={step.name} 
                    fill
                    style={{ 
                      padding: "20%",
                      objectFit: "contain",
                      filter: isActive 
                        ? "brightness(0) invert(1)"
                        : "invert(27%) sepia(85%) saturate(3675%) hue-rotate(254deg) brightness(97%) contrast(93%)"
                    }}
                  />
                </div>
              </div>
              {!isCollapsed && step.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function WorkflowNavButtons() {
  const { basePath, currentStep } = useWorkflowNavigation();
  
  if (!basePath) return null;
  
  // Update navigation to skip overview page
  const prevLink = currentStep > 0 && currentStep !== -1
    ? `${basePath}/${WORKFLOW_STEPS[currentStep - 1].slug}`
    : null;
  
  const nextLink = currentStep < WORKFLOW_STEPS.length - 1 && currentStep !== -1
    ? `${basePath}/${WORKFLOW_STEPS[currentStep + 1].slug}`
    : null;
  
  if (!prevLink && !nextLink) return null;
  
  return (
    <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
      {prevLink ? (
        <Link 
          href={prevLink}
          className="inline-block"
        >
          <Button 
            variant="secondary"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            }
            className="flex items-center"
          >
            <div className="relative flex items-center justify-center mr-2 ml-2">
              <div 
                className="rounded-full flex items-center justify-center relative" 
                style={{ 
                  backgroundColor: "#ffffff",
                  border: "1px solid #E5E7EB",
                  width: "40px",
                  height: "40px"
                }}
              >
                <Image 
                  src={`/assets/icons/nav-icons/${WORKFLOW_STEPS[currentStep - 1].slug}.svg`} 
                  alt={WORKFLOW_STEPS[currentStep - 1].name} 
                  fill
                  style={{ 
                    padding: "20%",
                    objectFit: "contain",
                    filter: "invert(27%) sepia(85%) saturate(3675%) hue-rotate(254deg) brightness(97%) contrast(93%)"
                  }}
                />
              </div>
            </div>
            {WORKFLOW_STEPS[currentStep - 1].name}
          </Button>
        </Link>
      ) : (
        <div></div> // Empty div to maintain spacing
      )}
      
      {nextLink ? (
        <Link 
          href={nextLink}
          className="inline-block"
        >
          <Button
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 order-last" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            }
            className="flex flex-row-reverse items-center"
          >
            <div className="relative flex items-center justify-center mr-2 ml-2">
              <div 
                className="rounded-full flex items-center justify-center relative" 
                style={{ 
                  backgroundColor: "#7A2BF7",
                  border: "1px solid #7A2BF7",
                  width: "40px",
                  height: "40px"
                }}
              >
                <Image 
                  src={`/assets/icons/nav-icons/${WORKFLOW_STEPS[currentStep + 1].slug}.svg`} 
                  alt={WORKFLOW_STEPS[currentStep + 1].name} 
                  fill
                  style={{ 
                    padding: "20%",
                    objectFit: "contain",
                    filter: "brightness(0) invert(1)"
                  }}
                />
              </div>
            </div>
            {WORKFLOW_STEPS[currentStep + 1].name}
          </Button>
        </Link>
      ) : (
        <div></div> // Empty div to maintain spacing
      )}
    </div>
  );
} 