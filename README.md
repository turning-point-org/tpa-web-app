# Turning Point Web App

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Configuration

Create a `.env.local` file in the root directory with the following variables:

```
# Azure Cosmos DB (main database)
COSMOS_DB_ENDPOINT=''
COSMOS_DB_KEY=''
COSMOS_DB_DATABASE=''
COSMOS_DB_CONTAINER=''

# Azure Cosmos DB for RAG (vector database)
COSMOS_DB_RAG_ENDPOINT=''  # Can be the same as COSMOS_DB_ENDPOINT
COSMOS_DB_RAG_KEY=''       # Can be the same as COSMOS_DB_KEY
COSMOS_DB_RAG_DATABASE='db-tpa-dev' # Use your existing database name
COSMOS_DB_RAG_CONTAINER='container-tpa-rag-dev'

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT_NAME=tpawebappstoragedev
AZURE_STORAGE_ACCOUNT_KEY=YOUR_ACCOUNT_KEY
AZURE_STORAGE_CONTAINER_NAME=documents

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=''
AZURE_OPENAI_API_KEY=''
AZURE_OPENAI_DEPLOYMENT_NAME='text-embedding-ada-002'
```

### Azure OpenAI Setup

To configure the Azure OpenAI integration for document embeddings:

1. Create an Azure OpenAI service named "tpa-openai-service" or use an existing one
2. Deploy the "text-embedding-ada-002" model
3. Get the endpoint and API key from the Azure Portal
4. Add these values to your `.env.local` file

### Azure Cosmos DB Vector Setup

To configure the Cosmos DB for vector search:

1. Enable vector search on your existing Cosmos DB account
2. Create a new container named "container-tpa-rag-dev" with "/scanId" as the partition key
3. Configure the vector index with path "/embedding", dimensions 1536, and cosine distance

### Azure Blob Storage Setup

To configure file uploads to Azure Blob Storage:

1. Get your Azure Storage account key from the Azure Portal:
   - Go to your storage account (tpawebappstoragedev)
   - Navigate to "Access keys" under "Security + networking"
   - Copy one of the access keys
   
2. Replace `YOUR_ACCOUNT_KEY` in the `.env.local` file with your actual account key

3. Set the correct values for these environment variables:
   - `AZURE_STORAGE_ACCOUNT_NAME`: Your storage account name (e.g., tpawebappstoragedev for development)
   - `AZURE_STORAGE_ACCOUNT_KEY`: Your storage account access key
   - `AZURE_STORAGE_CONTAINER_NAME`: The blob container name (defaults to "documents" if not specified)

4. The application will automatically create the specified container in your storage account the first time a file is uploaded.

5. For production deployment, you can set up different storage accounts by modifying these environment variables.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
