import { NextRequest, NextResponse } from "next/server";
import { generateEmbeddings, generateChatCompletion } from "@/lib/openai";
import { searchSimilarDocuments } from "@/lib/vectordb";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get("slug");
    const workspaceId = searchParams.get("workspace_id");
    const scanId = searchParams.get("scan_id");

    if (!tenantSlug || !workspaceId || !scanId) {
      return NextResponse.json(
        { error: "Missing tenant slug, workspace ID, or scan ID" },
        { status: 400 }
      );
    }

    // Parse the request body
    const body = await req.json();
    const { 
      query, 
      conversationHistory = [], 
      documentStatus = "",
      companyInfo = null,
      formatInstructions = "Format lists with dashes (-) and use ** for bold text and * for italic. Use ### for section headings." 
    } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Missing query parameter" },
        { status: 400 }
      );
    }

    try {
      // Generate embeddings for the query
      console.log(`Generating embeddings for query: ${query}`);
      const embedding = await generateEmbeddings(query);
      
      if (!embedding || embedding.length === 0) {
        return NextResponse.json(
          { error: "Failed to generate embeddings for the query", results: [] },
          { status: 500 }
        );
      }
      
      console.log(`Embedding generated with dimension: ${embedding.length}`);
      
      // Search for relevant document chunks
      const results = await searchSimilarDocuments(embedding, scanId, 5);
      console.log(`Found ${results.length} relevant document chunks`);
      
      // Format results into context for the AI
      let context = "";
      let message = "";

      // Add document status to context
      if (documentStatus) {
        context += documentStatus + "\n\n";
      }
      
      // Add company info to context if available and not already in document status
      if (companyInfo && !documentStatus.includes("Company Information")) {
        context += "### Company Information\n\n";
        if (companyInfo.name) context += `- **Company Name:** ${companyInfo.name}\n`;
        if (companyInfo.website) context += `- **Website:** ${companyInfo.website}\n`;
        if (companyInfo.country) context += `- **Country:** ${companyInfo.country}\n`;
        if (companyInfo.industry) context += `- **Industry:** ${companyInfo.industry}\n`;
        if (companyInfo.description) context += `- **Description:** ${companyInfo.description}\n`;
        context += "\n";
      }

      // Add formatting instructions
      const formattingContext = `${formatInstructions}\n\n`;

      if (results.length > 0) {
        // Create context from document results
        context += "Document Content:\n";
        results.forEach((result, index) => {
          context += `Document section ${index + 1}:\n`;
          context += `${result.text}\n\n`;
        });
        
        // Check if the chat deployment name exists in env
        const chatDeploymentName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT_NAME;
        
        if (!chatDeploymentName) {
          console.log("No AZURE_OPENAI_CHAT_DEPLOYMENT_NAME found in environment, using raw document display");
          return createRawDocumentResponse(results, query, formatInstructions);
        }
        
        // Try generating AI response
        try {
          console.log("Generating AI response from document context");
          console.log(`Using conversation history with ${conversationHistory.length} messages`);
          // Add the formatting instructions to the context
          const aiResponse = await generateChatCompletion(query, formattingContext + context, conversationHistory);
          message = aiResponse;
        } catch (aiError) {
          console.error("Error generating AI response:", aiError);
          // Fall back to raw document display
          return createRawDocumentResponse(results, query, formatInstructions);
        }
        
        // Return the AI-generated response
        return NextResponse.json({
          message,
          results,
          query
        });
      } else {
        // No results found but still have document status information
        if (documentStatus) {
          try {
            console.log("Generating AI response from document status only");
            const aiResponse = await generateChatCompletion(
              query, 
              formattingContext + context, 
              conversationHistory
            );
            
            return NextResponse.json({
              message: aiResponse,
              results: [],
              query
            });
          } catch (aiError) {
            console.error("Error generating AI response:", aiError);
          }
        }
        
        // Default no results response
        return NextResponse.json({
          message: "I don't have any relevant information about that in the documents you've uploaded. Please try asking something else or upload more documents.",
          results: [],
          query
        });
      }
    } catch (innerError: any) {
      console.error("Error in vector search or embedding generation:", innerError);
      return NextResponse.json(
        { 
          error: `Error processing search: ${innerError.message || "Unknown error"}`,
          results: [] 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { 
        error: `Failed to process chat query: ${error.message || "Unknown error"}`,
        results: [] 
      },
      { status: 500 }
    );
  }
}

// Helper function to create a response with raw document data
function createRawDocumentResponse(results: any[], query: string, formatInstructions: string = "") {
  // If format instructions are provided, try to format the response with markdown
  if (formatInstructions) {
    return NextResponse.json({
      message: `Based on the documents you've uploaded, here's what I found:
      
${results.map((result, index) => 
  `- **Document section ${index + 1}:**\n   ${result.text.substring(0, 500)}${result.text.length > 500 ? '...' : ''}`
).join('\n\n')}`,
      results,
      query
    });
  }
  
  // Otherwise use the original formatting
  return NextResponse.json({
    message: `Based on the documents you've uploaded, here's what I found:\n\n${
      results.map((result, index) => 
        `Document section ${index + 1}:\n${
          result.text.substring(0, 500)}${result.text.length > 500 ? '...' : ''}\n\n`
      ).join('')
    }`,
    results,
    query
  });
} 