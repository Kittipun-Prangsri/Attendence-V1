const os = require('os');
const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 3000;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', async () => {
  const localIP = getLocalIP();
  console.log(`\n🚀 Server is running!`);
  console.log(`   ➜ Local:   http://localhost:${PORT}`);
  console.log(`   ➜ Network: http://${localIP}:${PORT}\n`);
  
  try {
    const connection = await db.getConnection();
    console.log(`✅ Successfully connected to database: ${process.env.DB_NAME} at ${process.env.DB_HOST}`);
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`Error Code: ${error.code || 'UNKNOWN'}`);
    console.error(`Message: ${error.message}`);
    console.error(`Target: ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME}`);
  }
});
