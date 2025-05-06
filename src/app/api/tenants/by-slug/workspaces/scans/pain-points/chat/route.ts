import { NextRequest, NextResponse } from "next/server";
import { generateChatCompletion } from "@/lib/openai";
import { getCompanyInfoForScan } from "@/lib/documentSummary";
import { container } from "@/lib/cosmos";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");
    const lifecycleId = searchParams.get("lifecycle_id");

    if (!tenantSlug || !workspaceId || !scanId || !lifecycleId) {
      return NextResponse.json(
        { error: "Missing tenant slug, workspace ID, scan ID, or lifecycle ID" },
        { status: 400 }
      );
    }

    // Parse the request body
    const body = await req.json();
    const { 
      query, 
      conversationHistory = [], 
      lifecycleContext = "",
      activeModes = { chat: true, interview: false, painpoint: false },
      formatInstructions = "Format lists with dashes (-) and use ** for bold text and * for italic. Use ### for section headings." 
    } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Missing query parameter" },
        { status: 400 }
      );
    }

    try {
      // Fetch company information for context
      let companyInfo = null;
      try {
        companyInfo = await getCompanyInfoForScan(tenantSlug, workspaceId, scanId);
        console.log(`Retrieved company info for scan ${scanId}: ${companyInfo ? companyInfo.name : 'None found'}`);
      } catch (error) {
        console.warn("Failed to retrieve company information:", error);
        // Continue even if company info retrieval fails
      }

      // Format company information as context
      let companyInfoSection = "";
      if (companyInfo) {
        companyInfoSection = `
### Company Information
- **Name**: ${companyInfo.name || 'Not specified'}
- **Industry**: ${companyInfo.industry || 'Not specified'}
- **Country**: ${companyInfo.country || 'Not specified'}
- **Description**: ${companyInfo.description || 'Not specified'}
- **Website**: ${companyInfo.website || 'Not specified'}
`;
      }

      // Fetch complete lifecycle data if we have a container connection
      let lifecycleData = null;
      let processContext = "";
      if (container) {
        try {
          // Query for the specific lifecycle by ID
          const query = `
            SELECT * FROM c 
            WHERE c.id = @lifecycleId 
            AND c.type = "lifecycle"
            AND c.scan_id = @scanId
            AND c.workspace_id = @workspaceId
            AND c.tenant_slug = @tenantSlug
          `;
          
          const { resources } = await container.items
            .query({
              query,
              parameters: [
                { name: "@lifecycleId", value: lifecycleId },
                { name: "@scanId", value: scanId },
                { name: "@workspaceId", value: workspaceId },
                { name: "@tenantSlug", value: tenantSlug }
              ],
            })
            .fetchAll();

          if (resources.length > 0) {
            lifecycleData = resources[0];
            
            // Create detailed process context if processes exist
            if (lifecycleData.processes && lifecycleData.processes.process_categories) {
              processContext = `
### Lifecycle Process Details
The "${lifecycleData.name}" lifecycle contains the following process categories and groups:
`;
              
              lifecycleData.processes.process_categories.forEach((category: any, categoryIndex: number) => {
                if (category.name) {
                  processContext += `
#### ${categoryIndex + 1}. ${category.name}
${category.description || 'No description provided'}
${category.score !== undefined ? `Score: ${category.score}` : ''}
`;
                  
                  // Add process groups if they exist
                  if (category.process_groups && category.process_groups.length > 0) {
                    category.process_groups.forEach((group: any, groupIndex: number) => {
                      if (group.name) {
                        processContext += `
- **${group.name}**: ${group.description || 'No description provided'} ${group.score !== undefined ? `(Score: ${group.score})` : ''}
`;
                      }
                    });
                  }
                }
              });
              
              // Add stakeholders if they exist
              if (lifecycleData.stakeholders && lifecycleData.stakeholders.length > 0) {
                processContext += `
### Stakeholders
The following stakeholders are involved in this lifecycle:
`;
                lifecycleData.stakeholders.forEach((stakeholder: any) => {
                  processContext += `- **${stakeholder.name}** (${stakeholder.role})\n`;
                });
              }
            }
          }
        } catch (error) {
          console.warn("Failed to retrieve complete lifecycle data:", error);
          // Continue even if lifecycle data retrieval fails
        }
      }

      // Build the full context with the lifecycle context from user input
      let context = "";

      // Add company information context
      if (companyInfoSection) {
        context += companyInfoSection + "\n\n";
      }

      // Add lifecycle context from user input
      if (lifecycleContext) {
        context += lifecycleContext + "\n\n";
      }

      // Add detailed process context if available
      if (processContext) {
        context += processContext + "\n\n";
      }

      // Add active mode information
      context += "### Active Interview Modes\n";
      Object.entries(activeModes).forEach(([mode, isActive]) => {
        if (isActive) {
          context += `- ${mode} mode is active\n`;
        }
      });
      context += "\n";

      // Add instructions for the AI based on active modes
      context += "### Interview Instructions\n";
      if (activeModes.interview) {
        context += "- Focus on conducting a structured interview about the business lifecycle\n";
        context += "- Ask probing questions to understand processes, challenges, and workflows\n";
      }
      
      if (activeModes.painpoint) {
        context += "- Focus on identifying and documenting specific pain points\n";
        context += "- When pain points are mentioned, help elaborate on their impacts and root causes\n";
        context += "- Suggest categorization of pain points (e.g., process, technology, people)\n";
      }
      
      context += "- Be concise but thorough in your responses\n";
      context += "- Use the detailed process information to provide specific insights about processes\n";
      context += "- Build on previous information from the conversation\n\n";

      // Add the formatting instructions to the context
      const formattingContext = `${formatInstructions}\n\n`;
      
      // Add system message to conversation history instead of as a separate parameter
      const systemMessage = {
        role: "system",
        content: "You are Ora, a pain point interview assistant focused on helping identify and document pain points in business lifecycles. You have detailed knowledge about the company and their specific business processes. Your goal is to conduct a thorough but concise interview to uncover challenges, inefficiencies, and areas for improvement within the specific lifecycle process categories and groups. When the user asks about specific processes, refer to the detailed process information provided."
      };
      
      // Create a new conversation history array with the system message at the beginning
      const updatedConversationHistory = [systemMessage, ...conversationHistory];
      
      // Generate AI response
      console.log("Generating AI response for pain point interview");
      console.log(`Using conversation history with ${updatedConversationHistory.length} messages`);
      
      const aiResponse = await generateChatCompletion(
        query, 
        formattingContext + context, 
        updatedConversationHistory
      );
      
      return NextResponse.json({
        message: aiResponse,
        query
      });
        
    } catch (innerError: any) {
      console.error("Error in pain point interview:", innerError);
      return NextResponse.json(
        { 
          error: `Error processing interview: ${innerError.message || "Unknown error"}`,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in pain point chat API:", error);
    return NextResponse.json(
      { 
        error: `Failed to process interview query: ${error.message || "Unknown error"}`,
      },
      { status: 500 }
    );
  }
} 