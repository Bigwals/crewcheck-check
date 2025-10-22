"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = void 0;
exports.getPool = getPool;
// src/db.ts
const mssql_1 = __importDefault(require("mssql"));
exports.sql = mssql_1.default;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    // user: "serveradmin@cc-sqlserver0401",
    password: process.env.AZURE_SQL_PASSWORD,
    // user: "serveradmin@cc-sqlserver0401",
    // password: process.env.AZURE_SQL_PASSWORD,
    // server: "cc-sqlserver0401.database.windows.net", // full FQDN
    // database: process.env.AZURE_SQL_DATABASE,
    port: Number(process.env.AZURE_SQL_PORT || 1433),
    options: {
        encrypt: true, // REQUIRED for Azure SQL
        trustServerCertificate: false,
        enableArithAbort: true,
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};
console.log("SQL Connection", process.env.AZURE_SQL_USER);
let pool = null;
async function getPool() {
    if (pool && pool.connected)
        return pool;
    pool = await new mssql_1.default.ConnectionPool(config).connect();
    pool.on('error', (err) => {
        console.error('MSSQL pool error', err);
        pool = null; // allow reconnect on next call
    });
    return pool;
}
