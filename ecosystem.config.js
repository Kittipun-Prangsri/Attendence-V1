module.exports = {
  apps: [
    {
      name: "attendance-api",
      script: "./src/index.js",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3004
      }
    },
    {
      name: "attendance-ngrok",
      script: "cmd.exe",
      args: "/c ngrok http 127.0.0.1:3004",
      watch: false,
      env: {
        PORT: 3004
      }
    },
    {
      name: "attendance-localtunnel",
      script: "cmd.exe",
      args: "/c npx -y localtunnel --port 3002",
      watch: false
    }
  ]
};
