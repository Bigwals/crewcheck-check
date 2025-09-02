"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db"); // <-- use our MSSQL pool
dotenv_1.default.config();
const PORT = process.env.PORT || 5000;
(async () => {
    try {
        const pool = await (0, db_1.getPool)();
        await pool.request().query('SELECT 1'); // sanity check query
        console.log('✅ Connected to Azure SQL Database');
        app_1.default.listen(PORT, () => {
            console.log(`🚀 Server is up & running on port ${PORT}`);
        });
    }
    catch (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    }
})();
