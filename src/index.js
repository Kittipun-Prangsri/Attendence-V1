const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  try {
    const connection = await db.getConnection();
    console.log(`✅ Successfully connected to database: ${process.env.DB_NAME} at ${process.env.DB_HOST}`);
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error.message);
  }
});
