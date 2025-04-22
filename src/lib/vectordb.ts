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
 * Search for documents by scan ID
 * This method retrieves document chunks from a specific scan
 * and assigns arbitrary similarity scores (not based on vector similarity)
 */
export async function searchSimilarDocuments(queryEmbedding: number[], scanId: string, limit: number = 5): Promise<Array<{text: string, score: number}>> {
  try {
    console.log(`Searching for documents in scan ${scanId}`);
    
    // Check if vector container is initialized
    if (!vectorContainer) {
      throw new Error('Vector DB container not initialized. Check your environment variables.');
    }
    
    // Simple query to get documents from this scan
    const query = `
      SELECT c.text, c.embedding
      FROM c
      WHERE c.scan_id = @scanId
      OFFSET 0 LIMIT ${limit * 3}
    `;
    
    const queryOptions = {
      query,
      parameters: [
        { name: "@scanId", value: scanId }
      ]
    };
    
    // Execute the query with partition key specified
    const { resources } = await vectorContainer.items
      .query(queryOptions, { partitionKey: scanId })
      .fetchAll();
    
    console.log(`Found ${resources.length} documents for scan ${scanId}`);
    
    // If we have embeddings, we can calculate similarity scores in memory
    // This avoids using database-specific vector functions
    let results: Array<{text: string, score: number}> = [];
    
    if (resources.length > 0 && resources[0].embedding) {
      console.log('Calculating similarity scores locally');
      
      // Calculate cosine similarity for each document
      results = resources.map((doc: any) => {
        // Calculate cosine similarity if both embeddings exist
        const similarity = doc.embedding && queryEmbedding ? 
                           calculateCosineSimilarity(queryEmbedding, doc.embedding) :
                           0;
        
        return {
          text: doc.text,
          score: similarity
        };
      });
      
      // Sort by score (highest similarity first)
      results.sort((a, b) => b.score - a.score);
      
      // Limit results
      results = results.slice(0, limit);
    } else {
      // Fallback to arbitrary scoring if no embeddings are available
      console.log('No embeddings found, using arbitrary scoring');
      results = resources.map((doc: any, index: number) => ({
        text: doc.text,
        score: 1 - (index * 0.1) // Higher score is better, so start from 1.0 and decrease
      }));
      
      // Limit results
      results = results.slice(0, limit);
    }
    
    return results;
  } catch (error) {
    console.error('Error searching documents:', error);
    
    // If everything fails, return an empty array
    return [];
  }
}

/**
 * Calculate cosine similarity between two vectors
 * Higher value (closer to 1) means more similar
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
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
 * Retrieve all document chunks for a specific scan in a single query
 * @param scanId The ID of the scan to retrieve chunks for
 * @returns An array of document chunks with text and embeddings
 */
export async function retrieveAllScanChunks(
  scanId: string
): Promise<Array<{text: string, embedding: number[], document_id: string}>> {
  try {
    console.log(`Retrieving all document chunks for scan ${scanId}`);
    
    // Check if vector container is initialized
    if (!vectorContainer) {
      throw new Error('Vector DB container not initialized. Check your environment variables.');
    }
    
    // Query to get all document chunks for this scan
    const query = `
      SELECT c.text, c.embedding, c.document_id
      FROM c
      WHERE c.scan_id = @scanId
    `;
    
    const queryOptions = {
      query,
      parameters: [
        { name: "@scanId", value: scanId }
      ]
    };
    
    // Execute the query with partition key specified
    const { resources } = await vectorContainer.items
      .query(queryOptions, { partitionKey: scanId })
      .fetchAll();
    
    console.log(`Retrieved ${resources.length} document chunks for scan ${scanId} in a single query`);
    
    return resources;
  } catch (error) {
    console.error('Error retrieving all document chunks:', error);
    return [];
  }
}

/**
 * Delete all chunks for a specific scan
 */
export async function deleteAllScanChunks(scanId: string): Promise<void> {
  try {
    console.log(`Deleting all chunks for scan ${scanId}`);
    
    // Check if vector container is initialized
    if (!vectorContainer) {
      throw new Error('Vector DB container not initialized. Check your environment variables.');
    }
    
    // Find all chunks for this scan
    const query = "SELECT c.id FROM c WHERE c.scan_id = @scanId";
    const { resources } = await vectorContainer.items
      .query({ 
        query, 
        parameters: [{ name: "@scanId", value: scanId }] 
      })
      .fetchAll();
    
    console.log(`Found ${resources.length} chunks to delete for scan ${scanId}`);
    
    // Delete each chunk
    for (const item of resources) {
      // Use the scan_id as the partition key
      await vectorContainer.item(item.id, scanId).delete();
    }
    
    console.log(`Successfully deleted all chunks for scan ${scanId}`);
  } catch (error) {
    console.error('Error deleting scan chunks:', error);
    throw error;
  }
} 