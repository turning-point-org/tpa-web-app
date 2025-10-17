#!/usr/bin/env node

/**
 * Migration Script: Add Volumetric Metrics to Existing Process Groups
 * 
 * This script migrates existing lifecycle documents in CosmosDB to include
 * volumetric metrics (aht, cycleTime, headcount, cost) for process groups
 * that were created before these fields were added to the application.
 * 
 * Usage:
 *   node scripts/historical-data-update/migrate-process-groups-volumetrics.js [options]
 * 
 * Options:
 *   --tenant-slug <slug>    Migrate only specific tenant (optional)
 *   --dry-run              Show what would be updated without making changes
 *   --batch-size <number>   Process documents in batches (default: 10)
 *   --verbose              Enable detailed logging
 * 
 * Environment Variables Required:
 *   COSMOS_DB_ENDPOINT
 *   COSMOS_DB_KEY
 *   COSMOS_DB_DATABASE
 *   COSMOS_DB_CONTAINER
 */

require('dotenv').config({ path: '.env.local' });

const { CosmosClient } = require('@azure/cosmos');

// Get command line arguments
const args = process.argv.slice(2);
const options = {
  tenantSlug: null,
  dryRun: false,
  batchSize: 10,
  verbose: false
};

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--tenant-slug':
      options.tenantSlug = args[++i];
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--batch-size':
      options.batchSize = parseInt(args[++i]) || 10;
      break;
    case '--verbose':
      options.verbose = true;
      break;
    case '--help':
      console.log(`
Usage: node migrate-process-groups-volumetrics.js [options]

Options:
  --tenant-slug <slug>    Migrate only specific tenant (optional)
  --dry-run              Show what would be updated without making changes
  --batch-size <number>   Process documents in batches (default: 10)
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

// Validation function for volumetric metrics
function needsVolumetricMetrics(group) {
  return !group.aht || !group.cycleTime || 
         group.headcount === undefined || group.headcount === null ||
         group.cost === undefined || group.cost === null;
}

// Function to add default volumetric metrics to a process group
function addVolumetricMetrics(group) {
  const updated = { ...group };
  
  if (!updated.aht) {
    updated.aht = {
      value: 0,
      unit: "min",
      base_minutes: 0
    };
  }
  
  if (!updated.cycleTime) {
    updated.cycleTime = {
      value: 0,
      unit: "min",
      base_minutes: 0
    };
  }
  
  if (updated.headcount === undefined || updated.headcount === null) {
    updated.headcount = 0;
  }
  
  if (updated.cost === undefined || updated.cost === null) {
    updated.cost = 0;
  }
  
  return updated;
}

// Function to log messages based on verbosity level
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (level === 'verbose' && !options.verbose) return;
  
  console.log(`${prefix} ${message}`);
}

// Main migration function
async function migrateProcessGroupsVolumetrics() {
  try {
    log("Starting migration of process groups to include volumetric metrics...");
    log(`Connection details:`);
    log(`  Endpoint: ${endpoint}`);
    log(`  Database: ${databaseId}`);
    log(`  Container: ${containerId}`);
    log(`  Batch Size: ${options.batchSize}`);
    log(`  Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
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
      AND IS_DEFINED(c.processes.process_categories)
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
    
    log(`Found ${lifecycles.length} lifecycle documents to check`);
    
    let updatedCount = 0;
    let totalProcessGroupsUpdated = 0;
    let totalProcessGroupsChecked = 0;
    const errors = [];
    
    // Process lifecycles in batches
    for (let i = 0; i < lifecycles.length; i += options.batchSize) {
      const batch = lifecycles.slice(i, i + options.batchSize);
      log(`Processing batch ${Math.floor(i / options.batchSize) + 1}/${Math.ceil(lifecycles.length / options.batchSize)} (${batch.length} documents)`, 'verbose');
      
      for (const lifecycle of batch) {
        let lifecycleUpdated = false;
        let processGroupsInLifecycle = 0;
        let processGroupsUpdatedInLifecycle = 0;
        
        // Check if this lifecycle has process categories
        if (lifecycle.processes?.process_categories && Array.isArray(lifecycle.processes.process_categories)) {
          
          for (const category of lifecycle.processes.process_categories) {
            if (category.process_groups && Array.isArray(category.process_groups)) {
              
              for (const group of category.process_groups) {
                totalProcessGroupsChecked++;
                processGroupsInLifecycle++;
                
                if (needsVolumetricMetrics(group)) {
                  const updatedGroup = addVolumetricMetrics(group);
                  
                  // Update the group in the category
                  const groupIndex = category.process_groups.indexOf(group);
                  category.process_groups[groupIndex] = updatedGroup;
                  
                  processGroupsUpdatedInLifecycle++;
                  totalProcessGroupsUpdated++;
                  lifecycleUpdated = true;
                  
                  log(`  Updated process group: ${group.name} in category: ${category.name}`, 'verbose');
                }
              }
            }
          }
        }
        
        // If this lifecycle was updated, save it back to CosmosDB
        if (lifecycleUpdated) {
          if (options.dryRun) {
            log(`[DRY RUN] Would update lifecycle: ${lifecycle.name} (${lifecycle.id}) - ${processGroupsUpdatedInLifecycle}/${processGroupsInLifecycle} process groups updated`);
          } else {
            try {
              lifecycle.updated_at = new Date().toISOString();
              await container.item(lifecycle.id, lifecycle.tenant_id).replace(lifecycle);
              updatedCount++;
              log(`✓ Updated lifecycle: ${lifecycle.name} (${lifecycle.id}) - ${processGroupsUpdatedInLifecycle}/${processGroupsInLifecycle} process groups updated`);
            } catch (error) {
              const errorMsg = `✗ Failed to update lifecycle ${lifecycle.name} (${lifecycle.id}): ${error.message}`;
              log(errorMsg, 'error');
              errors.push(errorMsg);
            }
          }
        } else if (options.verbose) {
          log(`No updates needed for lifecycle: ${lifecycle.name} (${lifecycle.id})`, 'verbose');
        }
      }
      
      // Add a small delay between batches to avoid overwhelming the database
      if (i + options.batchSize < lifecycles.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Final summary
    log(`\nMigration ${options.dryRun ? 'simulation ' : ''}completed!`);
    log(`- Lifecycles processed: ${lifecycles.length}`);
    log(`- Lifecycles ${options.dryRun ? 'would be ' : ''}updated: ${updatedCount}`);
    log(`- Process groups checked: ${totalProcessGroupsChecked}`);
    log(`- Process groups ${options.dryRun ? 'would be ' : ''}updated: ${totalProcessGroupsUpdated}`);
    
    if (errors.length > 0) {
      log(`- Errors encountered: ${errors.length}`, 'error');
      if (options.verbose) {
        errors.forEach(error => log(error, 'error'));
      }
    }
    
    if (updatedCount === 0 && !options.dryRun) {
      log(`\nNo lifecycles needed updating. All process groups already have volumetric metrics.`);
    }
    
    if (options.dryRun) {
      log(`\nThis was a dry run. No changes were made to the database.`);
      log(`Run without --dry-run to perform the actual migration.`);
    }
    
  } catch (error) {
    log(`Error during migration: ${error.message}`, 'error');
    if (options.verbose) {
      log(error.stack, 'error');
    }
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateProcessGroupsVolumetrics();
}

module.exports = { migrateProcessGroupsVolumetrics, addVolumetricMetrics, needsVolumetricMetrics };
