# Backup and Migration Guide

This guide provides step-by-step instructions for safely backing up your Cosmos DB and running the volumetric metrics migration.

## 🛡️ Backup Options (Choose One)

### Option 1: Enable Continuous Backup (Recommended)
**Best for**: Production environments where you want self-service restore capability.

#### Steps:
1. **Azure Portal**:
   - Go to Azure Portal → Your Cosmos DB Account
   - Navigate to **Backup & restore** → **Continuous backup**
   - Click **Enable** and confirm
   - Wait for configuration (usually 1-2 minutes)

2. **Azure CLI** (Alternative):
   ```bash
   az cosmosdb sql service create \
     --account-name "your-cosmos-account" \
     --resource-group "your-resource-group" \
     --name "sql" \
     --type "ContinuousBackup"
   ```

**Benefits**:
- ✅ Self-service point-in-time restore (last 30 days)
- ✅ No Azure Support ticket needed
- ✅ Perfect for migration rollback
- ✅ Automatic and continuous

### Option 2: Manual Data Export
**Best for**: Quick backup or when you need specific data export.

#### Steps:
1. **Run backup script**:
   ```bash
   # Backup all lifecycles
   node scripts/historical-data-update/backup-lifecycles.js --verbose
   
   # Backup specific tenant only
   node scripts/historical-data-update/backup-lifecycles.js --tenant-slug "swiftbank" --verbose
   
   # Custom output file
   node scripts/historical-data-update/backup-lifecycles.js --output "pre-migration-backup.json" --verbose
   ```

2. **Verify backup**:
   - Check the generated JSON file
   - Verify document count matches expectations
   - Store backup file securely

### Option 3: Built-in Periodic Backup (Already Active)
**Best for**: Minimal intervention - relies on existing 4-hour backups.

- Already enabled by default
- Requires Azure Support for restore
- Good as secondary backup

## 🚀 Migration Workflow

### Step 1: Pre-Migration Preparation
```bash
# 1. Enable continuous backup (if not already enabled)
# See Option 1 above

# 2. Create manual backup (optional but recommended)
node scripts/historical-data-update/backup-lifecycles.js --verbose

# 3. Test migration with dry run
node scripts/historical-data-update/migrate-process-groups-volumetrics.js --dry-run --verbose
```

### Step 2: Test Migration (Recommended)
```bash
# Test on specific tenant first
node scripts/historical-data-update/migrate-process-groups-volumetrics.js \
  --tenant-slug "test-tenant" \
  --dry-run \
  --verbose

# If dry run looks good, run on test tenant
node scripts/historical-data-update/migrate-process-groups-volumetrics.js \
  --tenant-slug "test-tenant" \
  --verbose
```

### Step 3: Production Migration
```bash
# Run full migration with verbose logging
node scripts/historical-data-update/migrate-process-groups-volumetrics.js --verbose
```

### Step 4: Verification
1. **Check application UI**: Verify process groups show volumetric metrics
2. **Query database**: Confirm data structure is correct
3. **Test functionality**: Ensure existing features still work

## 🔄 Rollback Procedures

### If Using Continuous Backup
1. **Azure Portal**:
   - Go to Cosmos DB Account → **Backup & restore**
   - Click **Restore**
   - Select point-in-time before migration
   - Confirm restore

2. **Azure CLI**:
   ```bash
   az cosmosdb sql restorable-database restore \
     --account-name "your-cosmos-account" \
     --resource-group "your-resource-group" \
     --restore-timestamp "2024-01-15T10:00:00Z"
   ```

### If Using Manual Backup
1. **Stop application** (if possible)
2. **Restore from JSON backup**:
   ```bash
   # You would need to create a restore script or use Azure Data Factory
   # This is more complex and not recommended for quick rollback
   ```

### If Using Periodic Backup
1. **Contact Azure Support**
2. **Request point-in-time restore**
3. **Wait for support response** (can take hours)

## 📊 Monitoring and Validation

### During Migration
- Monitor Azure App Service logs
- Watch Cosmos DB metrics for write operations
- Check for any error messages

### After Migration
1. **Data Validation**:
   ```sql
   -- Query to check process groups have volumetric metrics
   SELECT c.id, c.name, 
          ARRAY_LENGTH(c.processes.process_categories) as category_count,
          (SELECT VALUE COUNT(1) 
           FROM cat IN c.processes.process_categories 
           JOIN group IN cat.process_groups 
           WHERE IS_DEFINED(group.aht) AND IS_DEFINED(group.cycleTime) 
           AND IS_DEFINED(group.headcount) AND IS_DEFINED(group.cost)) as groups_with_metrics
   FROM c 
   WHERE c.type = "lifecycle"
   ```

2. **Application Testing**:
   - Navigate to lifecycle pages
   - Create new process groups (should have metrics)
   - Edit existing process groups
   - Verify all functionality works

## 🚨 Emergency Procedures

### If Migration Fails Mid-Process
1. **Stop the migration script** (Ctrl+C)
2. **Check error logs** for specific failures
3. **Run dry run** to see what was updated:
   ```bash
   node scripts/historical-data-update/migrate-process-groups-volumetrics.js --dry-run --verbose
   ```
4. **Re-run migration** (it's idempotent - safe to run again)

### If Data Corruption is Suspected
1. **Stop application immediately**
2. **Restore from backup** using chosen method
3. **Investigate root cause**
4. **Re-run migration with fixes**

## 📝 Best Practices

### Before Migration
- ✅ Test on non-production data first
- ✅ Enable continuous backup
- ✅ Create manual backup
- ✅ Run dry run to verify changes
- ✅ Notify team of maintenance window

### During Migration
- ✅ Monitor logs and metrics
- ✅ Run with verbose logging
- ✅ Process in batches for large datasets
- ✅ Have rollback plan ready

### After Migration
- ✅ Validate data integrity
- ✅ Test application functionality
- ✅ Monitor for issues
- ✅ Document any issues encountered

## 💡 Tips

1. **Run during low-traffic hours** to minimize impact
2. **Use smaller batch sizes** for large datasets: `--batch-size 5`
3. **Keep backups for at least 30 days** after successful migration
4. **Test rollback procedure** before running migration
5. **Have Azure Support contact ready** if using periodic backup

## 📞 Support Contacts

- **Azure Support**: For periodic backup restores
- **Internal Team**: For application-specific issues
- **Documentation**: This guide and README files
