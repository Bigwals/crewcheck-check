import cron from "node-cron";
import moment from "moment-timezone";
import { getPool } from "../config/db";  
import { sendPushToUser } from "../helper/notifications";

export const startSequenceJob = () => {
  // Run every hour
  cron.schedule("0 * * * *", async () => {
    const now = moment().tz("America/New_York"); // US Eastern
    if (now.hour() === 0) {
      console.log("Running midnight job at", now.format());

      const pool = await getPool();

      // Fetch sequences completed today
      const result = await pool.request().query(`
        SELECT us.UserSequenceID, us.UserID
        FROM dbo.UserSequence us
        WHERE CAST(us.ThruDate AS DATE) = CAST(GETDATE() AS DATE)
      `);

      const sequences = result.recordset;

      // Send push to each user
      for (const seq of sequences) {
        await sendPushToUser(
          seq.UserID,
          "Sequence Completed ✅",
          "Your applied sequence has been completed. Check details in the app."
        );
      }

      console.log(`✅ Sent ${sequences.length} notifications`);
    }
  });
};
