import admin from "firebase-admin";
import { getPool, sql } from "../config/db";

// initialize once (at startup)
admin.initializeApp({
  credential: admin.credential.cert(require("./firebase-service-account.json")),
});

export async function sendPushToUser(userId: string, title: string, body: string) {
  const pool = await getPool();
  const result = await pool.request()
    .input("userId", sql.UniqueIdentifier, userId)
    .query("SELECT DeviceToken FROM Users WHERE UserID = @userId");

  const deviceToken = result.recordset[0]?.DeviceToken;

  if (!deviceToken) return;

  await admin.messaging().send({
    token: deviceToken,
    notification: { title, body },
  });
}
