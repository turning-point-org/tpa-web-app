#!/usr/bin/env node

// Script to clear all embeddings from the vector database for a fresh start
require('dotenv').config({ path: '.env.local' });

const { CosmosClient } = require('@azure/cosmos');

// Get vector database settings from environment variables
const endpoint = process.env.COSMOS_DB_RAG_ENDPOINT || process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_RAG_KEY || process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_RAG_DATABASE || "db-tpa-dev";
const containerId = process.env.COSMOS_DB_RAG_CONTAINER || "container-tpa-rag-dev";

async function clearVectorDb() {
  try {
    console.log("Preparing to clear Vector Database...");
    console.log(`Connection details:`);
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  Database: ${databaseId}`);
    console.log(`  Container: ${containerId}`);
    
    // Create client
    const client = new CosmosClient({ endpoint, key });
    const database = client.database(databaseId);
    const container = database.container(containerId);
    
    // Query for all items
    const query = "SELECT c.id, c.scan_id FROM c";
    const { resources } = await container.items.query(query).fetchAll();
    
    console.log(`Found ${resources.length} embeddings to delete`);
    
    if (resources.length === 0) {
      console.log("No items to delete. Database is already empty.");
      return;
    }
    
    // Delete each item
    let deleted = 0;
    for (const item of resources) {
      try {
        await container.item(item.id, item.scan_id).delete();
        deleted++;
        if (deleted % 10 === 0) {
          console.log(`Deleted ${deleted}/${resources.length} items...`);
        }
      } catch (err) {
        console.error(`Failed to delete item ${item.id}: ${err.message}`);
      }
    }
    
    console.log(`Successfully deleted ${deleted}/${resources.length} items.`);
    console.log("Vector database has been cleared.");
  } catch (error) {
    console.error("Error clearing vector database:", error);
  }
}

// Run the clear
clearVectorDb(); 