#!/usr/bin/env node

/**
 * Backup Script: Export Lifecycle Documents
 * 
 * This script creates a backup of all lifecycle documents before running
 * the volumetric metrics migration.
 * 
 * Usage:
 *   node scripts/historical-data-update/backup-lifecycles.js [options]
 * 
 * Options:
 *   --tenant-slug <slug>    Backup only specific tenant (optional)
 *   --output <file>         Output file path (default: backup-lifecycles-YYYY-MM-DD.json)
 *   --verbose              Enable detailed logging
 */

require('dotenv').config({ path: '.env.local' });

const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);
const options = {
  tenantSlug: null,
  outputFile: null,
  verbose: false
};

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--tenant-slug':
      options.tenantSlug = args[++i];
      break;
    case '--output':
      options.outputFile = args[++i];
      break;
    case '--verbose':
      options.verbose = true;
      break;
    case '--help':
      console.log(`
Usage: node backup-lifecycles.js [options]

Options:
  --tenant-slug <slug>    Backup only specific tenant (optional)
  --output <file>         Output file path (default: backup-lifecycles-YYYY-MM-DD.json)
  --verbose              Enable detailed logging
  --help                 Show this help message

Environment Variables Required:
  COSMOS_DB_ENDPOINT
  COSMOS_DB_KEY
  COSMOS_DB_DATABASE
  COSMOS_DB_CONTAINER
      `);
      process.exit(0);
      break;
  }
}

// Get Cosmos DB settings from environment variables
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

// Function to log messages based on verbosity level
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (level === 'verbose' && !options.verbose) return;
  
  console.log(`${prefix} ${message}`);
}

// Main backup function
async function backupLifecycles() {
  try {
    log("Starting backup of lifecycle documents...");
    log(`Connection details:`);
    log(`  Endpoint: ${endpoint}`);
    log(`  Database: ${databaseId}`);
    log(`  Container: ${containerId}`);
    if (options.tenantSlug) {
      log(`  Target Tenant: ${options.tenantSlug}`);
    }
    
    if (!endpoint || !key || !databaseId || !containerId) {
      throw new Error('Missing required environment variables: COSMOS_DB_ENDPOINT, COSMOS_DB_KEY, COSMOS_DB_DATABASE, COSMOS_DB_CONTAINER');
    }
    
    // Create client
    const client = new CosmosClient({ endpoint, key });
    const database = client.database(databaseId);
    const container = database.container(containerId);
    
    // Build query based on options
    let query = `
      SELECT * FROM c 
      WHERE c.type = "lifecycle"
    `;
    
    const parameters = [];
    if (options.tenantSlug) {
      query += ` AND c.tenant_slug = @tenant_slug`;
      parameters.push({ name: "@tenant_slug", value: options.tenantSlug });
    }
    
    log(`Executing query: ${query}`, 'verbose');
    
    // Get all lifecycle documents
    const { resources: lifecycles } = await container.items
      .query({ query, parameters })
      .fetchAll();
    
    log(`Found ${lifecycles.length} lifecycle documents to backup`);
    
    // Create backup data structure
    const backupData = {
      timestamp: new Date().toISOString(),
      source: {
        endpoint: endpoint,
        database: databaseId,
        container: containerId
      },
      filters: {
        type: "lifecycle",
        tenantSlug: options.tenantSlug || "all"
      },
      count: lifecycles.length,
      documents: lifecycles
    };
    
    // Generate output filename if not provided
    let outputFile = options.outputFile;
    if (!outputFile) {
      const date = new Date().toISOString().split('T')[0];
      const tenantSuffix = options.tenantSlug ? `-${options.tenantSlug}` : '';
      outputFile = `backup-lifecycles${tenantSuffix}-${date}.json`;
    }
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write backup to file
    fs.writeFileSync(outputFile, JSON.stringify(backupData, null, 2));
    
    log(`Backup completed successfully!`);
    log(`- Documents backed up: ${lifecycles.length}`);
    log(`- Output file: ${outputFile}`);
    log(`- File size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
    
    // Show summary of what was backed up
    if (options.verbose && lifecycles.length > 0) {
      log(`\nBackup Summary:`, 'verbose');
      const tenantCounts = {};
      lifecycles.forEach(doc => {
        tenantCounts[doc.tenant_slug] = (tenantCounts[doc.tenant_slug] || 0) + 1;
      });
      
      Object.entries(tenantCounts).forEach(([tenant, count]) => {
        log(`  ${tenant}: ${count} lifecycle documents`, 'verbose');
      });
      
      // Show process groups count
      const totalProcessGroups = lifecycles.reduce((total, lifecycle) => {
        if (lifecycle.processes?.process_categories) {
          return total + lifecycle.processes.process_categories.reduce((catTotal, category) => {
            return catTotal + (category.process_groups?.length || 0);
          }, 0);
        }
        return total;
      }, 0);
      
      log(`  Total process groups: ${totalProcessGroups}`, 'verbose');
    }
    
  } catch (error) {
    log(`Error during backup: ${error.message}`, 'error');
    if (options.verbose) {
      log(error.stack, 'error');
    }
    process.exit(1);
  }
}

// Run the backup
if (require.main === module) {
  backupLifecycles();
}

module.exports = { backupLifecycles };
