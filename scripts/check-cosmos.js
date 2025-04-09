#!/usr/bin/env node

// Simple script to check if documents exist in the vector database
require('dotenv').config({ path: '.env.local' });

const { CosmosClient } = require('@azure/cosmos');

// Get vector database settings from environment variables
const endpoint = process.env.COSMOS_DB_RAG_ENDPOINT || process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_RAG_KEY || process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_RAG_DATABASE || "db-tpa-dev";
const containerId = process.env.COSMOS_DB_RAG_CONTAINER || "container-tpa-rag-dev";

async function checkVectorDb() {
  try {
    console.log("Checking Vector Database content...");
    console.log(`Connection details:`);
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  Database: ${databaseId}`);
    console.log(`  Container: ${containerId}`);
    
    // Create client
    const client = new CosmosClient({ endpoint, key });
    const database = client.database(databaseId);
    const container = database.container(containerId);
    
    // Check if container exists
    try {
      const { resource } = await container.read();
      if (resource) {
        console.log(`\nContainer exists: ${resource.id}`);
        
        // Query total document count
        const countQuery = "SELECT VALUE COUNT(1) FROM c";
        const { resources: [totalCount] } = await container.items.query(countQuery).fetchAll();
        console.log(`Total documents in vector container: ${totalCount}`);
        
        if (totalCount > 0) {
          console.log("\nVECTOR DATABASE IS WORKING CORRECTLY! Documents are being stored.");
        } else {
          console.log("\nNo documents found in vector container.");
          console.log("Possible issues:");
          console.log("1. No documents have been processed for embeddings yet");
          console.log("2. Document types being uploaded aren't supported for embedding generation");
          console.log("3. There might be errors during the embedding generation process");
        }
      }
    } catch (err) {
      console.error(`Error accessing container: ${err instanceof Error ? err.message : String(err)}`);
      console.log("The vector container might not exist or there might be connection issues.");
    }
  } catch (error) {
    console.error("Error checking vector database:", error);
  }
}

// Run the check
checkVectorDb(); 