#!/usr/bin/env node

/**
 * Simple server entry point for Azure App Service
 * This file ensures Azure can start the Next.js application properly
 */

const { spawn } = require('child_process');
const path = require('path');

// Get port from environment or default to 8080 (Azure's default)
const PORT = process.env.PORT || 8080;

console.log(`Starting Next.js application on port ${PORT}`);

// Start Next.js using the built-in next start command
const nextStart = spawn('node', [
  path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next'),
  'start',
  '-p',
  PORT.toString()
], {
  stdio: 'inherit',
  cwd: __dirname
});

// Handle process events
nextStart.on('error', (error) => {
  console.error('Failed to start Next.js:', error);
  process.exit(1);
});

nextStart.on('close', (code) => {
  console.log(`Next.js process exited with code ${code}`);
  process.exit(code);
});

// Handle shutdown signals
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  nextStart.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  nextStart.kill('SIGINT');
});
