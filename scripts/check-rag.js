#!/usr/bin/env node

// This script loads environment variables and runs the vector database check

require('dotenv').config({ path: '.env.local' });
require('ts-node').register();

// Run the vector database check
require('../src/lib/checkVectorDb'); 