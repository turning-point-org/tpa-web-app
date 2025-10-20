import { OpenAIClient, AzureKeyCredential } from "@azure/openai";

// Get OpenAI settings from environment variables
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "text-embedding-ada-002";

// Create OpenAI client only if we have the required environment variables
let client: OpenAIClient | null = null;

// Only initialize the client when the environment variables are available
if (endpoint && apiKey) {
  console.log(`Azure OpenAI configured with endpoint: ${endpoint}, deployment: ${deploymentName}`);
  client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
} else {
  // Log a warning instead of throwing an error at load time
  console.warn('Missing Azure OpenAI environment variables. Features requiring OpenAI will not work.');
}

/**
 * Generate embeddings for a text document
 * @param text The text to generate embeddings for
 * @returns An array of embedding values
 */
export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    // Check if client is initialized
    if (!client) {
      throw new Error('Azure OpenAI client not initialized. Check your environment variables.');
    }
    
    if (!text || text.trim().length === 0) {
      console.warn("Empty text provided for embedding generation");
      return [];
    }
    
    console.log(`Generating embeddings for text of length ${text.length}`);
    
    // Truncate text if it's too long (OpenAI has token limits)
    const truncatedText = text.length > 10000 ? text.substring(0, 10000) : text;
    if (truncatedText.length < text.length) {
      console.log(`Text was truncated from ${text.length} to ${truncatedText.length} characters`);
    }
    
    try {
      const result = await client.getEmbeddings(deploymentName, [truncatedText]);
      
      if (!result || !result.data || result.data.length === 0) {
        throw new Error("No embedding result returned from Azure OpenAI");
      }
      
      console.log(`Successfully generated embeddings with ${result.data[0].embedding.length} dimensions`);
      return result.data[0].embedding;
    } catch (apiError) {
      console.error("Azure OpenAI API error:", apiError);
      console.error("Verify your Azure OpenAI deployment name is correct:", deploymentName);
      throw new Error(`Azure OpenAI API error: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
    }
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw error;
  }
}

/**
 * Process document text and generate embeddings
 * This will chunk the document if it's too large
 * @param text The document text to process
 * @returns Array of chunks with their embeddings
 */
export async function processDocument(text: string): Promise<Array<{text: string, embedding: number[]}>> {
  // Split text into chunks of approximately 8000 chars (Ada-002 limit)
  const MAX_CHUNK_SIZE = 8000;
  const chunks: string[] = [];
  
  if (text.length <= MAX_CHUNK_SIZE) {
    chunks.push(text);
  } else {
    // Simple chunking by paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = "";
    
    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length <= MAX_CHUNK_SIZE) {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      } else {
        // If current chunk has content, save it
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // Start new chunk with current paragraph
        // If paragraph itself is too long, we'll need to split it
        if (paragraph.length > MAX_CHUNK_SIZE) {
          // Split long paragraph into sentences
          const sentences = paragraph.split(/(?<=[.!?])\s+/);
          currentChunk = "";
          
          for (const sentence of sentences) {
            if ((currentChunk + sentence).length <= MAX_CHUNK_SIZE) {
              currentChunk += (currentChunk ? " " : "") + sentence;
            } else {
              if (currentChunk) {
                chunks.push(currentChunk);
              }
              // If the sentence itself is too long, split it into MAX_CHUNK_SIZE pieces
              if (sentence.length > MAX_CHUNK_SIZE) {
                for (let i = 0; i < sentence.length; i += MAX_CHUNK_SIZE) {
                  chunks.push(sentence.substring(i, i + MAX_CHUNK_SIZE));
                }
              } else {
                currentChunk = sentence;
              }
            }
          }
        } else {
          currentChunk = paragraph;
        }
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk) {
      chunks.push(currentChunk);
    }
  }
  
  // Generate embeddings for each chunk
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const embedding = await generateEmbeddings(chunk);
      return { text: chunk, embedding };
    })
  );
  
  return results;
}

/**
 * Generate a chat completion using Azure OpenAI
 * @param query The user's latest question
 * @param context The document context to use for answering
 * @param conversationHistory Previous messages in the conversation
 * @returns The AI-generated response
 */
export async function generateChatCompletion(
  query: string, 
  context: string, 
  conversationHistory: Array<{role: string, content: string}> = []
): Promise<string> {
  try {
    // Check if client is initialized
    if (!client) {
      throw new Error('Azure OpenAI client not initialized. Check your environment variables.');
    }
    
    // Use a default deployment name if not specified in .env
    const chatDeploymentName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT_NAME || "gpt-5";
    
    console.log(`Generating chat completion using deployment: ${chatDeploymentName}`);
    
    // Start with the system message
    const messages = [
      { 
        role: "system", 
        content: `You are an AI assistant for Turning Point Advisory's data room. Your role is to help staff with the upload and preparation of documents relevant to analyzing a business. This analysis phase is called a "Scan" workflow within Turning Point Advisory.

Your primary responsibilities:
1. Answer questions about documents that have been uploaded to the data room
2. Provide information about which documents are needed for the Scan workflow
3. Explain why specific documents (HRIS Report, Org Structure, Strategy Copy, Cost Breakdown, Technology Roadmaps, General Ledger, and Data Capability) are important for business analysis
4. Maintain context throughout the conversation
5. Reference the company information provided in your responses when relevant
6. Assess whether uploaded documents align with their intended document type and provide feedback
7. IMPORTANT: When answering questions about specific documents, always evaluate whether the document's content actually matches its labeled type and inform the user if there's a mismatch

Only use information from the provided document context to answer specific questions about document content. If the context doesn't contain relevant information about a specific question, clearly state that. However, you should be generally knowledgeable about business analysis concepts and the purpose of different document types.

DOCUMENT TYPE ASSESSMENT:
For each document type, you should actively assess whether the content matches what would be expected in that type of document:

1. HRIS Report: Should contain employee data, headcount statistics, organizational demographic information, salary/compensation details, training/development metrics, or similar human resource information.

2. Org Structure: Should clearly outline the organizational hierarchy, reporting lines, departmental structures, team compositions, leadership roles, or similar organizational structure information.

3. Strategic Objectives: Should detail the company's mission, vision, strategic goals, initiatives, projects, market positioning, competitive analysis, or similar strategic planning information.

4. Cost Breakdown (GL Codes): Should contain detailed financial information with expense categories, cost centers, general ledger codes, budgets, actual expenses, or similar cost accounting information.

5. Technology Roadmaps: Should outline IT infrastructure plans, software implementations, digital transformation initiatives, technology adoption timelines, system integrations, or similar technology planning information.

6. General Ledger: Should contain financial transactions, accounting entries, account balances, financial statements components, or similar accounting records.

7. Data Capability: Should describe data management systems, data governance processes, analytics capabilities, reporting tools, data architecture, or similar information about how the company handles data.

CONTENT RELEVANCE EVALUATION:
When answering questions about specific documents, apply the following criteria:

1. Content Match: Does the actual content of the document match the document type label?
2. Comprehensiveness: Is the document detailed enough to provide valuable business insights?
3. Quality: Is the information well-structured and usable for business analysis?
4. Relevance to Company: Is the content specifically about the company being analyzed (not generic templates)?

If a document's content does not match expectations or appears incorrect:
- Clearly state that the document may not contain the expected content type
- Explain specifically what content you would expect to see in that document type
- Suggest which document type might better match the content based on what you observe
- Recommend that the user either relabel the document or upload a more appropriate one
- Even if the document is mislabeled, still try to answer the user's question based on the content provided

For example: "While I can answer your question based on the document content, I should point out that this file labeled 'Strategic Objectives' appears to contain financial projections rather than strategic goals. This would typically be better categorized as a 'Financial Forecast' document. For a proper Strategic Objectives document, you would expect to see information about the company's mission, vision, and strategic initiatives."

If you notice that a document's content does not match its labeled type, you should:
- Politely inform the user that the content may not align with the expected document type
- Explain what content would typically be expected for that document type
- Suggest which document type might be more appropriate for the content if possible
- Recommend clarification or re-uploading of a more suitable document if necessary

You will be provided with the company information (name, website, country, industry, description) in the context. Always refer to the specific company by name and use details about its industry, country, and description when providing analysis or recommendations.

IMPORTANT FORMATTING INSTRUCTIONS:
1. Always use British English spelling (e.g., "organisation" not "organization", "analyse" not "analyze")
2. Format your responses using Markdown:
   - Use ### for headings
   - Use ** for bold text
   - Use * for italic text
   - Use - for bullet points
   - Use numbered lists (1., 2., etc.) for ordered lists
   - Use > for blockquotes
   - Use [text](URL) for links
   - Use backticks for code or \`\`\` for code blocks
3. Use a consistent structure in your responses:
   - Add clear headings with ### to separate sections
   - Use bold for important terms or key points
   - Use bullet lists for multiple items or options
   - Use line breaks between sections for readability
4. Format lists consistently:
   - Each bullet point should start with - followed by a space
   - For titled bullet points, use - **Title:** Description format
   - Always add a line break before and after lists
5. Keep your formatting clean and minimal:
   - Only use formatting when it improves readability
   - Maintain consistent spacing throughout
   - Don't overuse formatting elements

Maintain a professional, helpful tone and refer to previous parts of the conversation when relevant.`
      }
    ];
    
    // Add conversation history (excluding system messages)
    if (conversationHistory.length > 0) {
      const filteredHistory = conversationHistory.filter(msg => msg.role !== "system");
      messages.push(...filteredHistory);
    }
    
    // Add the current context and query
    messages.push({ role: "user", content: `Context information from documents:\n\n${context}\n\nQuestion: ${query}` });
    
    try {
      const result = await client.getChatCompletions(chatDeploymentName, messages);
      
      if (!result || !result.choices || result.choices.length === 0) {
        throw new Error("No completion result returned from Azure OpenAI");
      }
      
      const responseText = result.choices[0].message?.content || "I couldn't generate a response.";
      return responseText;
    } catch (apiError: any) {
      console.error("Azure OpenAI Chat API error:", apiError);
      console.error("Verify your Azure OpenAI chat deployment name is correct:", chatDeploymentName);
      
      const helpMessage = `
To fix this error:
1. Go to the Azure Portal: https://portal.azure.com
2. Navigate to your Azure OpenAI service: tpa-openai-service
3. Click on "Model deployments"
4. Deploy a chat model (e.g., gpt-35-turbo or gpt-4)
5. Update your .env.local file with:
   AZURE_OPENAI_CHAT_DEPLOYMENT_NAME='your-deployed-model-name'
`;
      console.error(helpMessage);
      
      // Extract more detailed error information
      let errorDetails = "Unknown error";
      if (apiError.statusCode) {
        errorDetails = `Status: ${apiError.statusCode}`;
        if (apiError.statusCode === 404) {
          errorDetails += ` - The deployment '${chatDeploymentName}' likely doesn't exist in your Azure OpenAI service.`;
        } else if (apiError.statusCode === 401 || apiError.statusCode === 403) {
          errorDetails += " - Authentication or authorization issue with Azure OpenAI.";
        }
      }
      
      if (apiError.message) {
        errorDetails += ` Message: ${apiError.message}`;
      }
      
      // For development - log the full error object structure
      console.error("Full API error object:", JSON.stringify(apiError, null, 2));
      
      throw new Error(`Azure OpenAI Chat API error: ${errorDetails}`);
    }
  } catch (error) {
    console.error("Error generating chat completion:", error);
    throw error;
  }
} 