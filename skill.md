# Project Skills & Quick Start Guide

This file outlines the local development setup, structure, and database connection details for **Attendance-V1**.

## Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: MySQL (via `mysql2`)
- **Process Manager**: nodemon (for development hot-reloading)

## Configuration
The environment variables are stored in the [.env](file:///D:/website/Attendence-V1/.env) file:
- Port: `3004` (used for Express server)
- Database host: `192.168.80.7`

## Running the Application
- **Development Mode** (auto-reload):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```

## Running with PM2 & ngrok (Production)
We use PM2 to manage both the Express server and the ngrok tunnel concurrently in the background.

To start both services:
```bash
pm2 start ecosystem.config.js
```

To manage the services:
- **Check status**: `pm2 list`
- **View logs**: `pm2 logs` (or `pm2 logs attendance-api` / `pm2 logs attendance-ngrok`)
- **Stop services**: `pm2 stop ecosystem.config.js`
- **Restart services**: `pm2 restart ecosystem.config.js`
- **Delete services**: `pm2 delete ecosystem.config.js`
