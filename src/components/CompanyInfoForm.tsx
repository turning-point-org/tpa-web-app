"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/Button";

type CompanyInfoFormProps = {
  initialData?: {
    name: string;
    website: string;
    country: string;
    industry: string;
    description: string;
    research?: string;
  };
  onSubmitSuccess?: () => void;
};

export default function CompanyInfoForm({
  initialData,
  onSubmitSuccess,
}: CompanyInfoFormProps) {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const workspaceId = params.workspace as string;
  const scanId = params.scan as string;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    website: initialData?.website || "",
    country: initialData?.country || "",
    industry: initialData?.industry || "",
    description: initialData?.description || "",
  });

  const formatMarkdown = (text: string) => {
    if (!text) return '';
    
    // Format headings
    let formatted = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    formatted = formatted.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    formatted = formatted.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    
    // Format bold and italic
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Format lists
    formatted = formatted.replace(/^\- (.*$)/gm, '• $1<br/>');
    
    // Format paragraphs
    formatted = formatted.replace(/\n\n/g, '<br/><br/>');
    formatted = formatted.replace(/\n/g, '<br/>');
    
    return formatted;
  };

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        website: initialData.website || "",
        country: initialData.country || "",
        industry: initialData.industry || "",
        description: initialData.description || "",
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const url = `/api/tenants/by-slug/workspaces/scans/company-details?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`;
      
      const method = initialData ? "PATCH" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save company information");
      }

      // After successful save, generate company research
      try {
        const researchUrl = `/api/tenants/by-slug/workspaces/scans/company-research?slug=${tenantSlug}&workspace_id=${workspaceId}&scan_id=${scanId}`;
        await fetch(researchUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        // Research generation started, we don't need to wait for completion
      } catch (researchError) {
        console.error("Failed to start company research process:", researchError);
        // We continue even if research generation fails
      }

      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while saving");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-xl font-medium mb-4">Company Information</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name*
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            <input
              type="text"
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        {/* <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div> */}
        
        {initialData?.research && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Research
            </label>
            <div 
              className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 prose prose-sm max-w-none h-64 overflow-y-auto resize-y"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(initialData.research) }}
            />
          </div>
        )}
        
        <div className="mt-6">
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : scanId ? "Update Company" : "Save Company"}
          </Button>
        </div>
      </form>
    </div>
  );
} 