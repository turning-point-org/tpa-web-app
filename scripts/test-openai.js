#!/usr/bin/env node

// Simple script to test Azure OpenAI connection
require('dotenv').config({ path: '.env.local' });

const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');

// Get OpenAI settings from environment variables
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "text-embedding-ada-002";

async function testOpenAI() {
  console.log("Testing Azure OpenAI connection...");
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Deployment: ${deploymentName}`);
  
  if (!endpoint || !apiKey) {
    console.error("ERROR: Missing Azure OpenAI environment variables.");
    return;
  }
  
  try {
    // Create OpenAI client
    const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
    
    // Try to generate an embedding
    console.log("\nTrying to generate embedding for a simple text...");
    const result = await client.getEmbeddings(deploymentName, ["This is a test of the Azure OpenAI embedding service."]);
    
    if (result && result.data && result.data.length > 0) {
      console.log(`SUCCESS! Generated embedding with ${result.data[0].embedding.length} dimensions.`);
      console.log("Your Azure OpenAI service is working correctly!");
    } else {
      console.log("ERROR: Received empty response from Azure OpenAI.");
    }
  } catch (error) {
    console.error("ERROR connecting to Azure OpenAI:", error.message);
    console.log("\nTroubleshooting tips:");
    console.log("1. Check that your API key is correct");
    console.log("2. Verify that your deployment name matches exactly what's in Azure AI Studio");
    console.log("3. Make sure your Azure OpenAI service is in a region that supports embeddings");
  }
}

// Run the test
testOpenAI(); 