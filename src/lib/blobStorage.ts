import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

// Get storage account settings from environment variables
const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || 'tpawebappstoragedev';
const storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || '';
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents';

// Create storage credentials and connection string
const sharedKeyCredential = storageAccountKey ? 
  new StorageSharedKeyCredential(storageAccountName, storageAccountKey) : null;

// Dynamically construct the connection string from the separate parts
const connectionString = `DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${storageAccountKey};EndpointSuffix=core.windows.net`;

// Create the BlobServiceClient
let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ContainerClient | null = null;

if (storageAccountKey) {
  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  containerClient = blobServiceClient.getContainerClient(containerName);
}

/**
 * Generate a SAS token for a blob
 * @param blobName The name of the blob
 * @param expiryMinutes How many minutes until the SAS token expires
 * @returns The SAS token URL
 */
export function generateSasToken(blobName: string, expiryMinutes: number = 60): string {
  if (!sharedKeyCredential) {
    throw new Error('Storage credentials not configured');
  }

  const startsOn = new Date();
  const expiresOn = new Date(startsOn);
  expiresOn.setMinutes(startsOn.getMinutes() + expiryMinutes);

  const sasOptions = {
    containerName,
    blobName: blobName,
    permissions: BlobSASPermissions.parse("r"), // Read-only permission
    startsOn,
    expiresOn,
  };

  const sasToken = generateBlobSASQueryParameters(
    sasOptions,
    sharedKeyCredential
  ).toString();

  return `https://${storageAccountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
}

/**
 * Uploads a file to Azure Blob Storage
 * @param fileBuffer The file buffer to upload
 * @param fileName A unique name for the blob
 * @param contentType The content type of the file
 * @returns The URL of the uploaded blob with SAS token
 */
export async function uploadToBlobStorage(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  if (!containerClient) {
    throw new Error('Azure Blob Storage is not configured. Check your AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY environment variables.');
  }

  // Create blob client for the file
  const blobClient = containerClient.getBlockBlobClient(fileName);
  
  // Set content type
  const options = { 
    blobHTTPHeaders: { 
      blobContentType: contentType 
    } 
  };
  
  // Upload the file
  await blobClient.uploadData(fileBuffer, options);
  
  // Generate a SAS URL for the blob
  return generateSasToken(fileName);
}

/**
 * Ensure the container exists before uploading files
 */
export async function ensureContainerExists(): Promise<void> {
  if (!containerClient) {
    throw new Error('Azure Blob Storage is not configured. Check your AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY environment variables.');
  }
  
  try {
    // Create the container if it doesn't exist - with private access
    await containerClient.createIfNotExists();
    console.log(`Container '${containerName}' created or already exists.`);
  } catch (error) {
    console.error(`Error creating container '${containerName}':`, error);
    throw error;
  }
}

/**
 * Get the storage account name from environment
 */
export function getStorageAccountName(): string {
  return storageAccountName;
}

/**
 * Delete a blob from Azure Blob Storage
 * @param blobName The name/path of the blob to delete
 * @returns A promise that resolves when the blob has been deleted
 */
export async function deleteFromBlobStorage(blobName: string): Promise<void> {
  if (!containerClient) {
    throw new Error('Azure Blob Storage is not configured. Check your AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY environment variables.');
  }

  try {
    // Get a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Delete the blob
    await blockBlobClient.delete();
    console.log(`Blob "${blobName}" deleted successfully`);
  } catch (error) {
    console.error(`Error deleting blob "${blobName}":`, error);
    throw error;
  }
} 