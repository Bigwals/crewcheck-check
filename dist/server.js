"use strict";
// import app from './app';
// import dotenv from 'dotenv';
// import { getPool } from './config/db';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// dotenv.config();
// const PORT = process.env.PORT || 4000;
// app.listen(PORT, async () => {
//   console.log(`🚀 Server is up & running on port ${PORT}`);
//   try {
//     const pool = await getPool();
//     await pool.request().query('SELECT 1');
//     console.log('✅ Connected to Azure SQL Database');
//   } catch (err) {
//     console.error('❌ Database connection failed:', err);
//   }
// });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
dotenv_1.default.config();
const PORT = process.env.PORT || 4000;
const server = http_1.default.createServer(app_1.default);
server.timeout = 5 * 60 * 1000; // 5 minutes in milliseconds
server.listen(PORT, async () => {
    console.log(`🚀 Server is up & running on port ${PORT}`);
    try {
        const pool = await (0, db_1.getPool)();
        await pool.request().query('SELECT 1');
        console.log('✅ Connected to Azure SQL Database');
    }
    catch (err) {
        console.error('❌ Database connection failed:', err);
    }
});
