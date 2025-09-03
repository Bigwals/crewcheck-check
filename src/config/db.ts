// src/db.ts
import sql, { ConnectionPool, config as SqlConfig } from 'mssql';

// Load dotenv only in non-production
if (process.env.NODE_ENV !== 'production') {
    import('dotenv').then(dotenv => dotenv.config());
}

const config: SqlConfig = {
    server: process.env.AZURE_SQL_SERVER!,
    // server: "serveradmin@cc-sqlserver0401",
    database: process.env.AZURE_SQL_DATABASE,
    // user: process.env.AZURE_SQL_USER,
    user: "serveradmin@cc-sqlserver0401",
    password: process.env.AZURE_SQL_PASSWORD,
    port: Number(process.env.AZURE_SQL_PORT || 1433),
    options: {
        encrypt: true,               // REQUIRED for Azure SQL
        trustServerCertificate: false,
        enableArithAbort: true,
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};

// Log which SQL user is being used (without password)
console.log("🔑 SQL Connection User:", config.user);
console.log("🌐 SQL Server:", config.server);
console.log("🗄️ Database:", config.database);

let pool: ConnectionPool | null = null;

export async function getPool(): Promise<ConnectionPool> {
    if (pool && pool.connected) return pool;

    try {
        pool = await new sql.ConnectionPool(config).connect();

        pool.on('error', (err: any) => {
            console.error('MSSQL pool error', err);
            pool = null; // allow reconnect on next call
        });

        console.log("✅ Connected to Azure SQL");
        return pool;
    } catch (err) {
        console.error('❌ Connection failed:', err);
        throw err;
    }
}

export { sql };
