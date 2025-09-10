// This file is no longer needed for Azure App Service deployment
// Azure App Service will automatically use 'npm start' command
// Keep this file for local PM2 development if needed

module.exports = {
  apps: [
    {
      name: "turning-point-web-app",
      script: "./node_modules/next/dist/bin/next",
      args: "start -p " + (process.env.PORT || 3000),
      watch: false,
      autorestart: true,
    },
  ],
};