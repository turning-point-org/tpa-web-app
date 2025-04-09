/**
 * Test script for RAG system
 * 
 * To run:
 * ts-node src/lib/testRag.ts
 */

import { generateEmbeddings } from './openai';
import { vectorSearch } from './vectordb';

// Test parameters
const scanId = "YOUR_SCAN_ID"; // Replace with an actual scan ID

async function testRAG() {
  try {
    console.log("Testing RAG system...");
    
    // Simple test query
    const query = "What is the organization structure?";
    console.log(`Query: "${query}"`);
    
    // Generate embeddings for the query
    console.log("Generating query embeddings...");
    const embedding = await generateEmbeddings(query);
    
    // Search for relevant documents
    console.log("Searching for relevant documents...");
    const results = await vectorSearch(embedding, scanId, 3);
    
    // Display results
    console.log("\nSearch Results:");
    if (results.length === 0) {
      console.log("No results found. Make sure you've uploaded documents and generated embeddings.");
    } else {
      results.forEach((result, index) => {
        console.log(`\nResult ${index + 1}:`);
        console.log(`Document: ${result.file_name} (${result.document_type})`);
        console.log(`Score: ${result.score}`);
        console.log(`Text snippet: ${result.text.substring(0, 200)}...`);
      });
    }
  } catch (error) {
    console.error("Error testing RAG system:", error);
  }
}

// Run the test
testRAG(); 