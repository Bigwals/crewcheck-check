// src/db.ts
import sql, { ConnectionPool, config as SqlConfig } from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config: SqlConfig = {
    server: process.env.AZURE_SQL_SERVER!,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
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

console.log("SQL Connection", process.env.AZURE_SQL_USER)

let pool: ConnectionPool | null = null;

export async function getPool(): Promise<ConnectionPool> {
    if (pool && pool.connected) return pool;

    pool = await new sql.ConnectionPool(config).connect();

    pool.on('error', (err: any) => {
        console.error('MSSQL pool error', err);
        pool = null; // allow reconnect on next call
    });

    return pool;
}

export { sql };

