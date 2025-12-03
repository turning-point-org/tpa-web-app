# 🚀 OpenAI Utility Tester Script

This repository contains a standalone Node.js script (`scripts/test_generateChatCompletion_with_resilience.ts`) designed to manually test the core Azure OpenAI utility functions, specifically `generateChatCompletion`, outside of the main Next.js application environment.

## 🌟 Prerequisites

To run this script, you must have the following:

1.  **Node.js** and **npm** (or yarn/pnpm) installed.
2.  **TypeScript** dependencies (`ts-node`, `typescript`) installed locally in your project (`npm install ts-node typescript`).
3.  A **`.env.local`** file in your project root containing the necessary Azure OpenAI configuration variables.

## 🛠️ Configuration

The utility relies on the following environment variables, which must be set for the script to initialize the Azure OpenAI client:

| Variable Name | Description | Example Value |
| :--- | :--- | :--- |
| `AZURE_OPENAI_ENDPOINT` | Your Azure OpenAI resource endpoint. | `https://your-service.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | Your primary or secondary API key. | `1234567890abcdef...` |
| `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` | The name of your deployed chat model (e.g., gpt-4, gpt-35-turbo). | `gpt-5` |

## 🧪 Running the Test Script

When running a standalone script with `ts-node`, the environment variables in `.env.local` **are not loaded automatically** (unlike when running `npm run dev` in Next.js).

You must manually source the environment variables into your shell before executing the script.

### 1. Load Environment Variables via Bash

Use the following bash commands to load all key-value pairs from your `.env.local` file and export them as environment variables for the current session:

```bash
# You are at Root level.
# 1. Turn on 'allexport' option (set -a)
#    This ensures all subsequent assignments (from 'source') are exported.
set -a

# 2. Source the .env.local file to load variables into the shell environment.
source .env.local

# 3. Turn off 'allexport' option (set +a)
set +a

# Now run the test command without setting the vars inline
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/test_generateChatCompletion_with_resilience.ts