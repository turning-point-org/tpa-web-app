import { CosmosClient, Container, BulkOperationType, FeedResponse } from '@azure/cosmos';

// Get vector database settings from environment variables
const endpoint = process.env.COSMOS_DB_RAG_ENDPOINT || process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_RAG_KEY || process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_RAG_DATABASE || "db-tpa-dev";
const containerId = process.env.COSMOS_DB_RAG_CONTAINER || "container-tpa-rag-dev";

// Initialize vector DB container only if environment variables are available
let vectorContainer: Container | null = null;

if (endpoint && key) {
  try {
    console.log(`Connecting to vector DB: ${endpoint}, database: ${databaseId}, container: ${containerId}`);
    const client = new CosmosClient({ endpoint, key });
    const database = client.database(databaseId);
    vectorContainer = database.container(containerId);
  } catch (error) {
    console.warn('Error initializing vector DB client:', error);
  }
} else {
  console.warn('Missing Azure Cosmos DB RAG environment variables. Vector search features will not work.');
}

/**
 * Store document chunks with embeddings to vector database
 */
export async function storeDocumentChunks(chunks: Array<{text: string, embedding: number[]}>, documentId: string, scanId: string): Promise<void> {
  try {
    // Check if vector container is initialized
    if (!vectorContainer) {
      throw new Error('Vector DB container not initialized. Check your environment variables.');
    }
    
    console.log(`Storing ${chunks.length} chunks for document ${documentId}`);
    
    // First, let's delete any existing chunks for this document
    await deleteDocumentChunks(documentId, scanId);
    
    // Now store the new chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Create item with embedding
      const item = {
        id: `${documentId}_chunk_${i}`,
        document_id: documentId,
        scan_id: scanId,
        text: chunk.text,
        embedding: chunk.embedding,
        chunk_index: i,
        created_at: new Date().toISOString()
      };
      
      console.log(`Storing chunk ${i+1}/${chunks.length} for document ${documentId}`);
      await vectorContainer.items.create(item);
    }
    
    console.log(`Successfully stored all ${chunks.length} chunks for document ${documentId}`);
  } catch (error) {
    console.error('Error storing document chunks:', error);
    throw error;
  }
}

/**
 * Delete all chunks for a specific document
 */
export async function deleteDocumentChunks(documentId: string, scanId: string): Promise<void> {
  try {
    console.log(`Deleting chunks for document ${documentId}`);
    
    // Check if vector container is initialized
    if (!vectorContainer) {
      throw new Error('Vector DB container not initialized. Check your environment variables.');
    }
    
    // Find all chunks for this document
    const query = "SELECT c.id, c.scan_id FROM c WHERE c.document_id = @documentId";
    const { resources } = await vectorContainer.items
      .query({ 
        query, 
        parameters: [{ name: "@documentId", value: documentId }] 
      })
      .fetchAll();
    
    console.log(`Found ${resources.length} chunks to delete for document ${documentId}`);
    
    // Delete each chunk
    for (const item of resources) {
      // Use the scan_id as the partition key instead of id
      await vectorContainer.item(item.id, item.scan_id).delete();
    }
  } catch (error) {
    console.error('Error deleting document chunks:', error);
    throw error;
  }
}

/**
 * Search for similar documents using vector similarity
 */
export async function searchSimilarDocuments(queryEmbedding: number[], scanId: string, limit: number = 5): Promise<Array<{text: string, score: number}>> {
  try {
    console.log(`Searching for similar documents in scan ${scanId}`);
    
    // Check if vector container is initialized
    if (!vectorContainer) {
      throw new Error('Vector DB container not initialized. Check your environment variables.');
    }
    
    try {
      // First try with vector search if available
      const query = `
        SELECT c.text, 
               VECTOR_DISTANCE_COSINE(c.embedding, @queryEmbedding) as score
        FROM c
        WHERE c.scan_id = @scanId
        ORDER BY score ASC
        OFFSET 0 LIMIT ${limit}
      `;
      
      const { resources } = await vectorContainer.items
        .query({
          query,
          parameters: [
            { name: "@queryEmbedding", value: queryEmbedding },
            { name: "@scanId", value: scanId }
          ]
        })
        .fetchAll();
      
      console.log(`Found ${resources.length} similar documents using vector search`);
      
      // Process results to the expected format
      const results = resources.map((doc: any) => ({
        text: doc.text,
        score: doc.score
      }));
      
      // Sort by score (lowest score = highest similarity)
      results.sort((a: any, b: any) => a.score - b.score);
      
      return results;
    } catch (vectorSearchError) {
      console.warn('Vector search failed, falling back to basic text search:', vectorSearchError);
      
      // Fallback: Simple text retrieval without vector search
      return await fallbackTextSearch(scanId, limit);
    }
  } catch (error) {
    console.error('Error searching similar documents:', error);
    throw error;
  }
}

/**
 * Fallback method when vector search is not available
 * Simply returns some document chunks from the scan without similarity ranking
 */
async function fallbackTextSearch(scanId: string, limit: number = 5): Promise<Array<{text: string, score: number}>> {
  try {
    console.log(`Using fallback text search for scan ${scanId}`);
    
    if (!vectorContainer) {
      throw new Error('Vector DB container not initialized. Check your environment variables.');
    }
    
    // Simple query to get documents from this scan without vector search
    const query = `
      SELECT c.text
      FROM c
      WHERE c.scan_id = @scanId
      OFFSET 0 LIMIT ${limit}
    `;
    
    const { resources } = await vectorContainer.items
      .query({
        query,
        parameters: [
          { name: "@scanId", value: scanId }
        ]
      })
      .fetchAll();
    
    console.log(`Found ${resources.length} documents using fallback method`);
    
    // Convert to the expected result format with arbitrary scores
    return resources.map((doc: any, index: number) => ({
      text: doc.text,
      score: index * 0.1 // Arbitrary score just to maintain interface
    }));
  } catch (error) {
    console.error('Error in fallback text search:', error);
    // If even the fallback fails, return an empty array
    return [];
  }
} 