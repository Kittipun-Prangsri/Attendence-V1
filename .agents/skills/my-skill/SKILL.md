---
name: my-skill
description: Custom helper for managing, developing, and deploying the Attendance-V1 project. Assists with Express backend, MySQL queries, and frontend assets.
---

# Workspace Skill: My Skill

This workspace skill helps you manage the **Attendance-V1** project efficiently. It contains common tasks, database schemas, and instructions for running and testing the project.

## Directory Structure
- [package.json](file:///D:/website/Attendence-V1/package.json): Node project manifest and script definitions.
- [src/index.js](file:///D:/website/Attendence-V1/src/index.js): Entrypoint for the Express server.
- [src/app.js](file:///D:/website/Attendence-V1/src/app.js): Express app configuration and middleware setup.
- [src/routes/api.js](file:///D:/website/Attendence-V1/src/routes/api.js): Backend API routes (authentication, dashboard stats, attendance logs, scanner endpoints).

## Database Tables
The application relies on a MySQL database with the following key tables:
- `hr_person`: Stores employee details, Fingle IDs, names, user types.
- `hikvision`: Stores attendance access logs with `EmployeeID`, `AccessDate`, `AccessTime`, and `AttendanceStatus`.
- `service_work_scans_morning`, `service_work_scans_afternoon`, `service_work_scans_night`: Stores attendance state summaries per month with daily columns (`di1` to `di31`).

## Development
- Run in development mode (with hot-reload):
  ```bash
  npm run dev
  ```
- Run in production mode:
  ```bash
  npm start
  ```

## Production with PM2 & ngrok
PM2 is configured to manage both the backend node process (`attendance-api`) and ngrok tunnel (`attendance-ngrok`) via [ecosystem.config.js](file:///D:/website/Attendence-V1/ecosystem.config.js):
- **Start both**: `pm2 start ecosystem.config.js`
- **List processes**: `pm2 list`
- **Show logs**: `pm2 logs`
- **Stop**: `pm2 stop ecosystem.config.js`
