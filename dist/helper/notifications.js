"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToUser = sendPushToUser;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const db_1 = require("../config/db");
// initialize once (at startup)
firebase_admin_1.default.initializeApp({
    credential: firebase_admin_1.default.credential.cert(require("./firebase-service-account.json")),
});
async function sendPushToUser(userId, title, body) {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request()
        .input("userId", db_1.sql.UniqueIdentifier, userId)
        .query("SELECT DeviceToken FROM Users WHERE UserID = @userId");
    const deviceToken = result.recordset[0]?.DeviceToken;
    if (!deviceToken)
        return;
    await firebase_admin_1.default.messaging().send({
        token: deviceToken,
        notification: { title, body },
    });
}
