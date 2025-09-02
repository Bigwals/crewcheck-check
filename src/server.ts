import app from './app';
import dotenv from 'dotenv';
import { getPool } from './config/db';

dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log(`🚀 Server is up & running on port ${PORT}`);

  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    console.log('✅ Connected to Azure SQL Database');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  }
});
