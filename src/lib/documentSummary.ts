import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { container } from "@/lib/cosmos";
import { DEFAULT_PROMPTS, DocumentType } from "@/lib/document-config";

// Get OpenAI settings from environment variables
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const chatDeploymentName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT_NAME || "gpt-35-turbo";

// Create OpenAI client
let client: OpenAIClient | null = null;

if (endpoint && apiKey) {
  client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
} else {
  console.warn('Missing Azure OpenAI environment variables. Document summarization feature will not work.');
}

/**
 * Summarize a document using OpenAI
 * 
 * @param documentType Type of document being summarized
 * @param fileName Name of the document file
 * @param documentContent Text content of the document
 * @param customPrompt Custom prompt to guide the summarization (optional)
 * @param companyInfo Company information to provide context (optional)
 * @param documentAgentRole Custom system prompt for the AI agent (optional)
 * @returns A string containing the document summary
 */
export async function summarizeDocument(
  documentType: string, 
  fileName: string, 
  documentContent: string, 
  customPrompt: string = '', 
  companyInfo: any = null, 
  documentAgentRole: string = ''
): Promise<string> {
  if (!client) {
    throw new Error("OpenAI client not initialized");
  }

  const companyInfoSection = companyInfo ? 
    `Company Information:
    Name: ${companyInfo.name || 'Not specified'}
    Industry: ${companyInfo.industry || 'Not specified'}
    Country: ${companyInfo.country || 'Not specified'}
    Description: ${companyInfo.description || 'Not specified'}
    Website: ${companyInfo.website || 'Not specified'}
    Research: ${companyInfo.research || 'Not specified'}` : 
    'No company information available';

  const summarizationPrompt = `
Please provide a summary of the following document:

Document Type: ${documentType}
Document Name: ${fileName}

Here is some information about the company that may help you summarize the document and give you more context:
${companyInfoSection}

Here are some important instructions to help guide you when summarizing the document:
${customPrompt}

The document content is:
${documentContent}
`;

  const messages = [
    { role: "system", content: documentAgentRole || "You are a business analyst who extracts and summarizes key information from business documents." },
    { role: "user", content: summarizationPrompt }
  ];

  const result = await client.getChatCompletions(chatDeploymentName, messages);
  
  if (!result || !result.choices || result.choices.length === 0) {
    throw new Error("No summary result returned from Azure OpenAI");
  }
  
  return result.choices[0].message?.content || "";
}

/**
 * Calculate cosine similarity between two vectors
 * Higher value (closer to 1) means more similar
 * 
 * @param vecA First vector
 * @param vecB Second vector
 * @returns Similarity score between 0 and 1
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  try {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    // Cosine similarity formula: dot(A, B) / (|A| * |B|)
    return dotProduct / (normA * normB);
  } catch (error) {
    console.error('Error calculating cosine similarity:', error);
    return 0;
  }
}

/**
 * Get company information for a scan
 * 
 * @param tenant_slug Tenant slug
 * @param workspace_id Workspace ID
 * @param scan_id Scan ID
 * @returns Company information object or null if not found
 */
export async function getCompanyInfoForScan(tenant_slug: string, workspace_id: string, scan_id: string): Promise<any> {
  if (!container) {
    throw new Error("Database connection not available");
  }
  
  const query = `
    SELECT * FROM c 
    WHERE c.scan_id = @scan_id 
    AND c.workspace_id = @workspace_id 
    AND c.tenant_slug = @tenant_slug 
    AND c.type = "company_info"
  `;
  
  const { resources } = await container.items
    .query({
      query,
      parameters: [
        { name: "@scan_id", value: scan_id },
        { name: "@workspace_id", value: workspace_id },
        { name: "@tenant_slug", value: tenant_slug },
      ],
    })
    .fetchAll();

  return resources.length > 0 ? resources[0] : null;
}

/**
 * Get or create summarization prompt for a document type
 * 
 * @param tenantSlug Tenant slug
 * @param workspaceId Workspace ID
 * @param scanId Scan ID
 * @param documentType Document type
 * @returns The summarization prompt
 */
export async function getSummarizationPrompt(tenantSlug: string, workspaceId: string, scanId: string, documentType: string): Promise<string> {
  // Try to find document settings with a summarization prompt
  const query = `
    SELECT * FROM c 
    WHERE c.scan_id = @scan_id 
    AND c.workspace_id = @workspace_id 
    AND c.tenant_slug = @tenant_slug 
    AND ((c.type = "document_settings" AND c.document_type = @document_type) 
         OR (c.type = "document" AND c.document_type = @document_type))
  `;
  
  if (!container) {
    throw new Error("Database connection not available");
  }
  
  const { resources } = await container.items
    .query({
      query,
      parameters: [
        { name: "@scan_id", value: scanId },
        { name: "@workspace_id", value: workspaceId },
        { name: "@tenant_slug", value: tenantSlug },
        { name: "@document_type", value: documentType },
      ],
    })
    .fetchAll();
  
  // Check for any document or settings with a prompt
  // First check for document_settings
  for (const resource of resources) {
    if (resource.type === 'document_settings' && resource.summarization_prompt) {
      return resource.summarization_prompt;
    }
  }
  
  // Then check for document with prompt
  for (const resource of resources) {
    if (resource.type === 'document' && resource.summarization_prompt) {
      return resource.summarization_prompt;
    }
  }
  
  // If not found, return default prompt based on document type
  return DEFAULT_PROMPTS[documentType as DocumentType] || 
    "Provide a comprehensive summary of this document, focusing on key information relevant to business processes, operations, and organizational structure.";
}

/**
 * Extract employee information from HRIS documents
 * 
 * @param fileName Name of the document file
 * @param documentContent Text content of the document
 * @returns A JSON array of employee objects with name and role
 */
export async function extractEmployeesFromHRIS(
  fileName: string,
  documentContent: string
): Promise<{name: string, role: string}[]> {
  if (!client) {
    throw new Error("OpenAI client not initialized");
  }

  const extractionPrompt = `
Extract all employee names and their roles from the following HRIS document.
Format the output as a valid JSON array where each object has "name" and "role" properties.
Focus only on extracting this specific information accurately.

Document Name: ${fileName}

The document content is:
${documentContent}

VERY IMPORTANT: Return ONLY the raw JSON array with no markdown formatting, backticks, or additional text. Do not include \`\`\`json or \`\`\` markers.
For example, return:
[
  {"name": "John Smith", "role": "Software Engineer"},
  {"name": "Jane Doe", "role": "Product Manager"}
]
`;

  const messages = [
    { 
      role: "system", 
      content: "You are an HR data extraction specialist who extracts structured employee data from HR documents. You always return valid, parseable JSON without any markdown formatting or code block markers." 
    },
    { role: "user", content: extractionPrompt }
  ];

  const result = await client.getChatCompletions(chatDeploymentName, messages);
  
  if (!result || !result.choices || result.choices.length === 0) {
    throw new Error("No extraction result returned from Azure OpenAI");
  }
  
  let content = result.choices[0].message?.content || "[]";
  
  try {
    // Clean the response - remove any markdown code block markers and whitespace
    content = content.trim();
    
    // Remove markdown code block markers if present
    content = content.replace(/^```(json)?/, '');
    content = content.replace(/```$/, '');
    content = content.trim();
    
    // Log the content we're trying to parse (for debugging)
    console.log("Attempting to parse employee data:", content.substring(0, 100) + (content.length > 100 ? "..." : ""));
    
    // Parse the JSON response
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to parse employee data as JSON:", error);
    
    // Try a more aggressive cleaning approach as fallback
    try {
      // Look for anything that looks like a JSON array
      const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/);
      if (jsonMatch && jsonMatch[0]) {
        console.log("Trying alternative parsing with extracted JSON array");
        return JSON.parse(jsonMatch[0]);
      }
    } catch (fallbackError) {
      console.error("Fallback parsing also failed:", fallbackError);
    }
    
    return [];
  }
} 