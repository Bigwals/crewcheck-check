import admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { getPool, sql } from "../config/db";

let firebaseReady: boolean | null = null;

const resolveServiceAccount = () => {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    return JSON.parse(inlineJson);
  }

  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const defaultPath = path.resolve(process.cwd(), "src/helper/firebase-service-account.json");
  const serviceAccountPath = configuredPath
    ? path.resolve(process.cwd(), configuredPath)
    : defaultPath;

  if (!fs.existsSync(serviceAccountPath)) {
    return null;
  }

  const fileContent = fs.readFileSync(serviceAccountPath, "utf-8");
  return JSON.parse(fileContent);
};

const ensureFirebase = () => {
  if (firebaseReady !== null) {
    return firebaseReady;
  }

  try {
    const serviceAccount = resolveServiceAccount();

    if (!serviceAccount) {
      console.warn("Firebase not configured. Push notifications are disabled.");
      firebaseReady = false;
      return firebaseReady;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    firebaseReady = true;
    return firebaseReady;
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    firebaseReady = false;
    return firebaseReady;
  }
};

export async function sendPushToUser(userId: string, title: string, body: string) {
  if (!ensureFirebase()) return;

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

export async function sendPushToMany(tokens: string[], title: string, body: string) {
  if (!ensureFirebase()) {
    return { successCount: 0, failureCount: 0 };
  }

  const validTokens = [...new Set(tokens.filter((token) => Boolean(token?.trim())))];

  if (!validTokens.length) {
    return { successCount: 0, failureCount: 0 };
  }

  let successCount = 0;
  let failureCount = 0;

  for (let index = 0; index < validTokens.length; index += 500) {
    const tokenChunk = validTokens.slice(index, index + 500);
    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokenChunk,
      notification: { title, body },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;
  }

  return { successCount, failureCount };
}
