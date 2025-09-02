"use strict";
// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = void 0;
exports.getPool = getPool;
// dotenv.config();
// const connectDB = async () => {
//     try {
//         const conn = await mongoose.connect(process.env.MONGODB_URI as string);
//         console.log(`MongoDB connected: ${conn.connection.host}`);
//     } catch (error) {
//         console.error(`MongoDB connection error: ${(error as Error).message}`);
//         process.exit(1); // Exit process with failure
//     }
// };
// export default connectDB;
// src/db.ts
const mssql_1 = __importDefault(require("mssql"));
exports.sql = mssql_1.default;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
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
