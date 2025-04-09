import { CosmosClient, Container } from '@azure/cosmos';

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

let container: Container | null = null;

if (endpoint && key && databaseId && containerId) {
  try {
    console.log(`Connecting to Cosmos DB: ${endpoint}, database: ${databaseId}, container: ${containerId}`);
    const client = new CosmosClient({ endpoint, key });
    const database = client.database(databaseId);
    container = database.container(containerId);
  } catch (error) {
    console.warn('Error initializing Cosmos DB client:', error);
  }
} else {
  console.warn('Missing Azure Cosmos DB environment variables. Database features will not work.');
}

export { container };
