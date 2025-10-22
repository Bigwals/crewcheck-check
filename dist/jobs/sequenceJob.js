"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSequenceJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const db_1 = require("../config/db");
const notifications_1 = require("../helper/notifications");
const startSequenceJob = () => {
    // Run every hour
    node_cron_1.default.schedule("0 * * * *", async () => {
        const now = (0, moment_timezone_1.default)().tz("America/New_York"); // US Eastern
        if (now.hour() === 0) {
            console.log("Running midnight job at", now.format());
            const pool = await (0, db_1.getPool)();
            // Fetch sequences completed today
            const result = await pool.request().query(`
        SELECT us.UserSequenceID, us.UserID
        FROM dbo.UserSequence us
        WHERE CAST(us.ThruDate AS DATE) = CAST(GETDATE() AS DATE)
      `);
            const sequences = result.recordset;
            // Send push to each user
            for (const seq of sequences) {
                await (0, notifications_1.sendPushToUser)(seq.UserID, "Sequence Completed ✅", "Your applied sequence has been completed. Check details in the app.");
            }
            console.log(`✅ Sent ${sequences.length} notifications`);
        }
    });
};
exports.startSequenceJob = startSequenceJob;
