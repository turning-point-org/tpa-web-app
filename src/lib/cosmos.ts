import { CosmosClient, Container } from '@azure/cosmos';

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

if (!endpoint || !key || !databaseId || !containerId) {
  throw new Error('Missing Azure Cosmos DB environment variables.');
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container: Container = database.container(containerId);

export { container };
