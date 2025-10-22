"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
dotenv_1.default.config();
const PORT = process.env.PORT || 4000;
app_1.default.listen(PORT, async () => {
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
