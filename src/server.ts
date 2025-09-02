import app from './app';
import dotenv from 'dotenv';
import { getPool } from './config/db';  // <-- use our MSSQL pool

dotenv.config();

const PORT = process.env.PORT || 4000;

(async () => {
    try {
        const pool = await getPool();
        await pool.request().query('SELECT 1'); // sanity check query
        console.log('✅ Connected to Azure SQL Database');

        app.listen(PORT, () => {
            console.log(`🚀 Server is up & running on port ${PORT}`);
        });
    } catch (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    }
})();
