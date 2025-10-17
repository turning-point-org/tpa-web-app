# Historical Data Update Scripts

This directory contains scripts for migrating and updating historical data in the TPA Web App database.

## migrate-process-groups-volumetrics.js

### Purpose
This script migrates existing lifecycle documents in CosmosDB to include volumetric metrics (`aht`, `cycleTime`, `headcount`, `cost`) for process groups that were created before these fields were added to the application.

### Background
The application was updated to include volumetric metrics in process groups. Historical lifecycle documents created before this update are missing these fields. This migration script adds the missing fields with default values to ensure consistency across all lifecycle documents.

### Volumetric Metrics Added
For each process group missing these fields, the script adds:
```json
{
  "aht": {
    "value": 0,
    "unit": "min",
    "base_minutes": 0
  },
  "cycleTime": {
    "value": 0,
    "unit": "min", 
    "base_minutes": 0
  },
  "headcount": 0,
  "cost": 0
}
```

### Usage

#### Basic Usage
```bash
# Run migration on all tenants
node scripts/historical-data-update/migrate-process-groups-volumetrics.js

# Dry run (see what would be updated without making changes)
node scripts/historical-data-update/migrate-process-groups-volumetrics.js --dry-run

# Migrate specific tenant only
node scripts/historical-data-update/migrate-process-groups-volumetrics.js --tenant-slug "swiftbank"

# Verbose logging
node scripts/historical-data-update/migrate-process-groups-volumetrics.js --verbose

# Custom batch size (default is 10)
node scripts/historical-data-update/migrate-process-groups-volumetrics.js --batch-size 5
```

#### Command Line Options
- `--tenant-slug <slug>`: Migrate only specific tenant (optional)
- `--dry-run`: Show what would be updated without making changes
- `--batch-size <number>`: Process documents in batches (default: 10)
- `--verbose`: Enable detailed logging
- `--help`: Show help message

### Environment Variables Required
The following environment variables must be set:
- `COSMOS_DB_ENDPOINT`
- `COSMOS_DB_KEY` 
- `COSMOS_DB_DATABASE`
- `COSMOS_DB_CONTAINER`

### Safety Features
- **Idempotent**: Safe to run multiple times - won't duplicate data
- **Dry Run**: Test what would be updated before making changes
- **Batch Processing**: Processes documents in configurable batches to avoid overwhelming the database
- **Error Handling**: Continues processing even if individual updates fail
- **Detailed Logging**: Provides comprehensive output about what was updated
- **Selective Updates**: Only updates process groups that are actually missing the volumetric metrics

### Deployment to Azure

#### Method 1: Azure Console
1. Deploy your code to Azure App Service
2. Access Azure Portal → Your App Service → Development Tools → Console
3. Navigate to: `cd /home/site/wwwroot`
4. Run: `node scripts/historical-data-update/migrate-process-groups-volumetrics.js --dry-run`
5. Review the dry run output
6. Run: `node scripts/historical-data-update/migrate-process-groups-volumetrics.js`

#### Method 2: Kudu PowerShell
1. Access Azure Portal → Your App Service → Advanced Tools (Kudu) → Debug console → PowerShell
2. Navigate to: `cd D:\home\site\wwwroot`
3. Run the same commands as above

### Testing Recommendations

#### Before Production Migration
1. **Test on specific tenant first**:
   ```bash
   node scripts/historical-data-update/migrate-process-groups-volumetrics.js --tenant-slug "test-tenant" --dry-run --verbose
   ```

2. **Review dry run output** to ensure correct updates

3. **Run on test tenant**:
   ```bash
   node scripts/historical-data-update/migrate-process-groups-volumetrics.js --tenant-slug "test-tenant" --verbose
   ```

4. **Verify results** in the application UI

5. **Run full migration**:
   ```bash
   node scripts/historical-data-update/migrate-process-groups-volumetrics.js --verbose
   ```

### Output Example
```
[2024-01-15T10:30:00.000Z] [INFO] Starting migration of process groups to include volumetric metrics...
[2024-01-15T10:30:00.000Z] [INFO] Connection details:
[2024-01-15T10:30:00.000Z] [INFO]   Endpoint: https://your-cosmos.documents.azure.com:443/
[2024-01-15T10:30:00.000Z] [INFO]   Database: your-database
[2024-01-15T10:30:00.000Z] [INFO]   Container: your-container
[2024-01-15T10:30:00.000Z] [INFO] Found 25 lifecycle documents to check
[2024-01-15T10:30:01.000Z] [INFO] ✓ Updated lifecycle: Customer (abc-123) - 3/5 process groups updated
[2024-01-15T10:30:01.000Z] [INFO] ✓ Updated lifecycle: Operations (def-456) - 2/4 process groups updated

[2024-01-15T10:30:02.000Z] [INFO] Migration completed!
[2024-01-15T10:30:02.000Z] [INFO] - Lifecycles processed: 25
[2024-01-15T10:30:02.000Z] [INFO] - Lifecycles updated: 18
[2024-01-15T10:30:02.000Z] [INFO] - Process groups checked: 127
[2024-01-15T10:30:02.000Z] [INFO] - Process groups updated: 45
```

### Rollback
If needed, the migration can be "rolled back" by removing the volumetric metrics fields from process groups. However, since the migration only adds default values (0), this is typically not necessary.

### Troubleshooting
- **Missing environment variables**: Ensure all required Cosmos DB environment variables are set
- **Permission errors**: Verify the Cosmos DB key has write permissions
- **Connection issues**: Check network connectivity to Cosmos DB endpoint
- **Partial failures**: Review error logs and re-run the script (it's idempotent)

### Monitoring
After running the migration, monitor:
- Application functionality in the UI
- Cosmos DB metrics for write operations
- Application logs for any issues
