import { CosmosClient, Container, BulkOperationType } from '@azure/cosmos';

// Get vector database settings from environment variables
const endpoint = process.env.COSMOS_DB_RAG_ENDPOINT || process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_RAG_KEY || process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_RAG_DATABASE || "db-tpa-dev";
const containerId = process.env.COSMOS_DB_RAG_CONTAINER || "container-tpa-rag-dev";

if (!endpoint || !key) {
  throw new Error('Missing Azure Cosmos DB RAG environment variables.');
}

console.log(`Connecting to vector DB: ${endpoint}, database: ${databaseId}, container: ${containerId}`);
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container: Container = database.container(containerId);

/**
 * Store document embeddings in Cosmos DB
 * @param documentId The ID of the original document
 * @param scanId The ID of the scan this document belongs to
 * @param tenantId The ID of the tenant
 * @param chunks Array of document chunks with embeddings
 */
export async function storeEmbeddings(
  documentId: string,
  scanId: string,
  tenantId: string,
  workspaceId: string,
  documentType: string,
  fileName: string,
  chunks: Array<{text: string, embedding: number[]}>
): Promise<void> {
  try {
    console.log(`Starting to store embeddings for document ${documentId} (${chunks.length} chunks)`);
    
    // First remove any existing embeddings for this document
    await removeEmbeddings(documentId);
    
    if (chunks.length === 0) {
      console.log("No chunks to store. Skipping.");
      return;
    }
    
    // Store each chunk individually instead of using bulk operations
    // This avoids potential formatting issues with the bulk API
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const item = {
        id: `${documentId}_chunk_${i}`,
        document_id: documentId,
        scan_id: scanId,
        tenant_id: tenantId,
        workspace_id: workspaceId,
        document_type: documentType,
        file_name: fileName,
        chunk_index: i,
        text: chunk.text,
        embedding: chunk.embedding,
        created_at: new Date().toISOString(),
      };
      
      console.log(`Storing chunk ${i+1}/${chunks.length} for document ${documentId}`);
      await container.items.create(item);
    }
    
    console.log(`Successfully stored all ${chunks.length} chunks for document ${documentId}`);
  } catch (error) {
    console.error("Error storing embeddings:", error);
    throw error;
  }
}

/**
 * Remove all embeddings for a document
 * @param documentId The ID of the document
 */
export async function removeEmbeddings(documentId: string): Promise<void> {
  try {
    // Find all chunks for this document
    const query = "SELECT c.id, c.scan_id FROM c WHERE c.document_id = @documentId";
    const { resources } = await container.items
      .query({ 
        query, 
        parameters: [{ name: "@documentId", value: documentId }]
      })
      .fetchAll();
    
    // Delete each chunk
    for (const item of resources) {
      // Use the scan_id as the partition key instead of id
      await container.item(item.id, item.scan_id).delete();
    }
  } catch (error) {
    console.error("Error removing embeddings:", error);
    throw error;
  }
}

/**
 * Find similar documents using vector search
 * @param query The query text
 * @param scanId The scan ID to search within
 * @param embedding The query embedding
 * @param limit Maximum number of results to return
 * @returns Array of matching document chunks
 */
export async function vectorSearch(
  embedding: number[],
  scanId: string,
  limit: number = 5
): Promise<Array<{document_id: string, document_type: string, file_name: string, text: string, score: number}>> {
  try {
    console.log(`Performing vector search for scan ID: ${scanId}`);
    
    // First, get all chunks for this scan
    const query = `
      SELECT c.document_id, c.document_type, c.file_name, c.text, c.embedding
      FROM c 
      WHERE c.scan_id = @scanId AND IS_ARRAY(c.embedding)
    `;
    
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: "@scanId", value: scanId }
        ]
      })
      .fetchAll();
    
    if (resources.length === 0) {
      console.log("No documents found for this scan");
      return [];
    }
    
    console.log(`Found ${resources.length} document chunks for scan ID: ${scanId}`);
    
    // Calculate cosine similarity in memory
    // Cosine similarity = dot product of vectors / (magnitude of vector1 * magnitude of vector2)
    const results = resources.map(doc => {
      // Calculate dot product
      const dotProduct = embedding.reduce((sum: number, val: number, i: number) => sum + val * doc.embedding[i], 0);
      
      // Calculate magnitudes
      const queryMagnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
      const docMagnitude = Math.sqrt(doc.embedding.reduce((sum: number, val: number) => sum + val * val, 0));
      
      // Calculate cosine similarity
      const cosineSimilarity = dotProduct / (queryMagnitude * docMagnitude);
      
      return {
        document_id: doc.document_id,
        document_type: doc.document_type,
        file_name: doc.file_name,
        text: doc.text,
        score: cosineSimilarity
      };
    });
    
    // Sort by similarity score (highest first) and take the top 'limit' results
    const topResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    console.log(`Found ${topResults.length} relevant chunks`);
    
    return topResults;
  } catch (error) {
    console.error("Error performing vector search:", error);
    throw error;
  }
} 