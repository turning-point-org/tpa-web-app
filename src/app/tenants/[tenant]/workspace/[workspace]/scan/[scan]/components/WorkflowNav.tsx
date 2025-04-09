"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkflowStep = {
  name: string;
  slug: string;
};

const WORKFLOW_STEPS: WorkflowStep[] = [
  { name: "Data Room", slug: "data-room" },
  { name: "Lifecycles", slug: "lifecycles" },
  { name: "Stakeholders", slug: "stakeholders" },
  { name: "Strategic Objectives", slug: "strategic-objectives" },
  { name: "Lifecycle Cost", slug: "lifecycle-cost" },
  { name: "Pain Points", slug: "pain-points" },
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
      isOverview: false,
      scanId: ""
    };
  }
  
  const scanId = pathParts[6];
  const basePath = `${pathParts.slice(0, 6).join("/")}/${scanId}`;
  
  // Check if we're on the overview page
  const isOverview = pathname === basePath;
  
  // Determine current step index
  let currentStep = -1;
  if (!isOverview) {
    const currentSlug = pathParts[7];
    currentStep = WORKFLOW_STEPS.findIndex(step => step.slug === currentSlug);
  }
  
  return {
    basePath,
    currentStep,
    isOverview,
    scanId
  };
}

export default function WorkflowNav() {
  const { basePath, isOverview } = useWorkflowNavigation();
  const pathname = usePathname();
  
  if (!basePath) return null;

  return (
    <div className="mb-8">
      <nav className="flex overflow-x-auto pb-2">
        {/* Overview link - maintain the scan ID */}
        <Link
          href={basePath}
          className={`px-4 py-2 mx-1 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${
            isOverview
              ? "bg-blue-100 text-blue-800"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Overview
        </Link>
        
        {WORKFLOW_STEPS.map((step) => {
          const href = `${basePath}/${step.slug}`;
          const isActive = pathname.includes(step.slug);
          
          return (
            <Link
              key={step.slug}
              href={href}
              className={`px-4 py-2 mx-1 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-100 text-blue-800"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {step.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function WorkflowNavButtons() {
  const { basePath, currentStep, isOverview } = useWorkflowNavigation();
  
  if (!basePath) return null;
  
  const prevLink = isOverview 
    ? null 
    : currentStep === 0
      ? basePath // If on first step, prev goes to overview
      : `${basePath}/${WORKFLOW_STEPS[currentStep - 1].slug}`;
  
  const nextLink = isOverview
    ? `${basePath}/${WORKFLOW_STEPS[0].slug}` // If on overview, next goes to first step
    : currentStep < WORKFLOW_STEPS.length - 1 && currentStep !== -1
      ? `${basePath}/${WORKFLOW_STEPS[currentStep + 1].slug}`
      : null;
  
  if (!prevLink && !nextLink) return null;
  
  return (
    <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
      {prevLink ? (
        <Link 
          href={prevLink}
          className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {isOverview ? "" : currentStep === 0 ? "Overview" : WORKFLOW_STEPS[currentStep - 1].name}
        </Link>
      ) : (
        <div></div> // Empty div to maintain spacing
      )}
      
      {nextLink ? (
        <Link 
          href={nextLink}
          className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center"
        >
          {isOverview ? WORKFLOW_STEPS[0].name : WORKFLOW_STEPS[currentStep + 1].name}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>
      ) : (
        <div></div> // Empty div to maintain spacing
      )}
    </div>
  );
} 