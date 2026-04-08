"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStubs = exports.handleFlightAwareWebhook = void 0;
exports.updateDailyFlights = updateDailyFlights;
const db_1 = require("../config/db");
const axios_1 = __importDefault(require("axios"));
require("dotenv").config();
const node_cron_1 = __importDefault(require("node-cron"));
// import moment from "moment";
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const handleFlightAwareWebhook = async (req, res) => {
    const event = req.body;
    try {
        // Example payload from FlightAware webhook
        const { ident, event: eventType, actual_out, actual_in, origin, destination, tailnumber, departure_delay, arrival_delay, status, seq_id, } = event;
        const pool = await (0, db_1.getPool)();
        // 1️⃣ Insert into UpdateTracking
        await pool.request()
            .input("update trfdesaFDSA_type_id", db_1.sql.Int, 1) // assuming 1 = FlightStatusUpdate
            .input("source_api_id", db_1.sql.Int, 1) // assuming 1 = FlightAware
            .input("from_station", db_1.sql.NVarChar, origin?.code || null)
            .input("to_station", db_1.sql.NVarChar, destination?.code || null)
            .input("packet", db_1.sql.NVarChar(db_1.sql.MAX), JSON.stringify(event))
            .input("update_message", db_1.sql.NVarChar, `Flight ${ident} ${status || eventType}`)
            .input("timestamp", db_1.sql.DateTime, new Date())
            .input("flight_number", db_1.sql.NVarChar, ident)
            .input("seq_id", db_1.sql.NVarChar, seq_id || null)
            .input("tail_number", db_1.sql.NVarChar, tailnumber || null)
            .query(`
            INSERT INTO UpdateTracking (
            update_type_id, source_api_id, from_station, to_station,
            packet, update_message, timestamp, flight_number, seq_id, tail_number
            )
            VALUES (
            @update_type_id, @source_api_id, @from_station, @to_station,
            @packet, @update_message, @timestamp, @flight_number, @seq_id, @tail_number
            )
      `);
        // 2️⃣ Update UserLeg table
        await pool.request()
            .input("flightStatus", db_1.sql.NVarChar, status || eventType)
            .input("actualDep", db_1.sql.DateTime, actual_out || null)
            .input("actualArr", db_1.sql.DateTime, actual_in || null)
            .input("delay", db_1.sql.Int, arrival_delay || departure_delay || 0)
            .input("flightNo", db_1.sql.NVarChar, ident)
            .query(`
            UPDATE UserLeg
            SET flightStatus = @flightStatus,
                actualDep = @actualDep,
                actualArr = @actualArr,
                delay = @delay
            WHERE flightNo = @flightNo
      `);
        // 3️⃣ Update UserSequence when all flights are done
        await pool.request().query(`
      UPDATE UserSequence
      SET status = 'Completed'
      WHERE seqNo IN (
        SELECT seqNo FROM UserLeg
        WHERE flightStatus = 'Landed'
        GROUP BY seqNo
        HAVING COUNT(*) = (
          SELECT COUNT(*) FROM UserLeg ul2 WHERE ul2.seqNo = UserLeg.seqNo
        )
      )
    `);
        return res.status(200).json({ success: true, message: "Webhook processed" });
    }
    catch (error) {
        console.error("❌ Webhook error:", error);
        return res.status(500).json({ success: false, message: "Error processing webhook" });
    }
};
exports.handleFlightAwareWebhook = handleFlightAwareWebhook;
// ✅ Route: /get-stubs/:flightNumber/:date
const getStubs = async (req, res) => {
    const pool = await (0, db_1.getPool)();
    try {
        // const { flightNumber, date } = req.query as { flightNumber: string; date: string };
        const { flightNumber } = req.query;
        if (!flightNumber) {
            return res.status(400).json({ success: false, message: "flightNumber and date are required" });
        }
        // const start = `${date}T00:00:00Z`;
        // const end = `${date}T23:59:59Z`;
        const FLIGHTAWARE_BASE_URL = "https://aeroapi.flightaware.com/aeroapi";
        const API_KEY = "NcYAnOY3xQVRp25AcvLGj4t1Ar6CE6fy";
        // const FLIGHTAWARE_BASE_URL = process.env.FLIGHTAWARE_BASE_URL;
        // const API_KEY = process.env.FLIGHTAWARE_API_KEY;
        // 🔹 Fetch flight data from FlightAware
        const response = await axios_1.default.get(`${FLIGHTAWARE_BASE_URL}/flights/${flightNumber}`, {
            // params: { start, end },
            headers: {
                "x-apikey": API_KEY,
                "Accept": "application/json",
            },
        });
        const flights = response.data.flights || [];
        return res.json({ flights });
        if (flights.length === 0) {
            return res.status(404).json({ success: false, message: "No flights found for the given date" });
        }
        // 🔹 Process each flight
        for (const flight of flights) {
            const status = flight.status?.toLowerCase() || "unknown";
            let mappedStatus = "Scheduled";
            if (status.includes("cancel"))
                mappedStatus = "Cancelled";
            else if (status.includes("delay"))
                mappedStatus = "Delayed";
            else if (status.includes("enroute") || status.includes("airborne"))
                mappedStatus = "In Progress";
            else if (status.includes("arrived") || status.includes("landed"))
                mappedStatus = "Completed";
            // 🔸 Update UserLeg table
            await pool.request()
                .input("FitNo", db_1.sql.Int, flight.flight_number)
                .input("status", db_1.sql.VarChar, mappedStatus)
                .query(`UPDATE UserLeg SET FlightStatus = @status WHERE FitNo = @FitNo`);
            // 🔸 Get SeqNo from UserLeg
            const result = await pool.request()
                .input("FitNo", db_1.sql.Int, flight.flight_number)
                .query(`SELECT SeqNo FROM UserLeg WHERE FitNo = @FitNo`);
            const seqId = result.recordset?.[0]?.SeqNo;
            // 🔸 Lookup airport ID from Airports table
            const locationResult = await pool.request()
                .input("code", db_1.sql.VarChar, flight.origin?.code)
                .query(`SELECT id FROM Airports WHERE icao_code = @code OR iata_code = @code`);
            const locationId = locationResult.recordset?.[0]?.id;
            if (!locationId) {
                console.warn(`Airport not found for code ${flight.origin?.code}, skipping UpdateTracking insert.`);
                continue; // Skip insert if airport not found
            }
            // 🔸 Insert into UpdateTracking
            const maxIdResult = await pool.request()
                .query(`SELECT ISNULL(MAX(update_id), 0) AS maxId FROM UpdateTracking`);
            const nextUpdateId = maxIdResult.recordset[0].maxId + 1;
            await pool.request()
                .input("update_id", db_1.sql.Int, nextUpdateId)
                .input("update_type_id", db_1.sql.Int, 1) // flight status update
                .input("logon", db_1.sql.DateTime, flight.actual_out || flight.estimated_out || flight.scheduled_out)
                .input("from_station", db_1.sql.VarChar, flight.origin?.code)
                .input("to_station", db_1.sql.VarChar, flight.destination?.code)
                .input("packet", db_1.sql.NVarChar, JSON.stringify(flight))
                .input("acars_type_id", db_1.sql.Int, 1)
                .input("update_message", db_1.sql.VarChar, flight.status)
                .input("timestamp", db_1.sql.DateTime, new Date())
                .input("flight_number", db_1.sql.VarChar, flight.flight_number)
                .input("seq_id", db_1.sql.Int, seqId)
                .input("tail_number", db_1.sql.VarChar, flight.registration)
                .input("crew_swap_flag", db_1.sql.Bit, 0)
                .input("FaAssignment_type_id", db_1.sql.Int, 1)
                .input("weather_update", db_1.sql.NVarChar, null)
                .input("source_api_id", db_1.sql.Int, 1)
                .input("location_id", db_1.sql.Int, locationId)
                .query(`
                    INSERT INTO UpdateTracking (
                        update_id, update_type_id, logon, from_station, to_station,
                        packet, acars_type_id, update_message, timestamp, location_id,
                        flight_number, seq_id, tail_number, crew_swap_flag, FaAssignment_type_id,
                        weather_update, source_api_id
                    )
                    VALUES (
                        @update_id, @update_type_id, @logon, @from_station, @to_station,
                        @packet, @acars_type_id, @update_message, @timestamp, @location_id,
                        @flight_number, @seq_id, @tail_number, @crew_swap_flag, @FaAssignment_type_id,
                        @weather_update, @source_api_id
                    )
                `);
        }
        // 🔹 Update UserSequence status if all flights completed
        const numericFlightNo = parseInt(flightNumber.replace(/\D/g, ''), 10);
        const sequence = await pool.request()
            .input("FitNo", db_1.sql.Int, numericFlightNo)
            .query(`SELECT SeqNo FROM UserLeg WHERE FitNo = @FitNo`);
        const seqId = sequence.recordset?.[0]?.SeqNo;
        if (seqId) {
            const checkFlights = await pool.request()
                .input("seq_id", db_1.sql.Int, seqId)
                .query(`
                    SELECT COUNT(*) AS total,
                           SUM(CASE WHEN FlightStatus = 'Completed' THEN 1 ELSE 0 END) AS completed
                    FROM UserLeg WHERE SeqNo = @seq_id
                `);
            const { total, completed } = checkFlights.recordset[0];
            if (total === completed) {
                await pool.request()
                    .input("seq_id", db_1.sql.Int, seqId)
                    .query(`UPDATE UserSequence SET status = 'Completed' WHERE SeqNo = @seq_id`);
            }
        }
        return res.status(200).json({
            success: true,
            message: "Flight stubs fetched, UserLeg and UpdateTracking updated successfully",
            data: flights,
        });
    }
    catch (error) {
        console.error("Error fetching or updating flight stubs:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to fetch or update flight stubs",
            error: error.response?.data || error.message,
        });
    }
    finally {
        pool.close();
    }
};
exports.getStubs = getStubs;
// 🔹 Daily cron job at 04:00 AM
node_cron_1.default.schedule("51 22 * * *", async () => {
    console.log("⏰ Running Flight Status Cron Job at:", new Date().toISOString());
    await updateDailyFlights();
});
/**
 * Updates today's flights for all users by fetching FlightAware data
 * and syncing status + update tracking records.
 */
async function updateDailyFlights() {
    const pool = await (0, db_1.getPool)();
    try {
        // const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        // console.log(`🔍 Processing flights for ${today}`);
        const today = (0, moment_timezone_1.default)().tz("Asia/Karachi").format("YYYY-MM-DD");
        console.log("🔍 Processing flights for", today);
        // Step 1: Fetch all legs ordered by SeqLegNo
        const result = await pool.request().query(`
      SELECT * FROM UserLeg ORDER BY SeqNo, SeqLegNo
    `);
        const allLegs = result.recordset;
        if (allLegs.length === 0) {
            console.log("⚠️ No user legs found.");
            return;
        }
        // Step 2: Group legs by sequence
        const groupedBySeq = groupBy(allLegs, "SeqLegNo");
        for (const [seqNo, legs] of Object.entries(groupedBySeq)) {
            let currentDate = new Date(legs[0].EffDate); // start with effective date
            for (let i = 0; i < legs.length; i++) {
                const leg = legs[i];
                // Increment date when previous leg had EOD = 1
                if (i > 0 && legs[i - 1].EOD === 1) {
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                const legDate = currentDate.toISOString().split("T")[0];
                if (legDate === today) {
                    console.log(`🛫 Processing flight ${leg.FitNo} (SeqNo: ${seqNo}) for ${today}`);
                    // Step 3: Fetch FlightAware data
                    const flightData = await fetchFlightData(leg.FitNo, legDate);
                    // return res.json({ flightData })
                    if (!flightData)
                        continue;
                    // Step 4: Map flight status
                    const status = flightData.status?.toLowerCase() || "unknown";
                    let mappedStatus = "Scheduled";
                    if (status.includes("cancel"))
                        mappedStatus = "Cancelled";
                    else if (status.includes("delay"))
                        mappedStatus = "Delayed";
                    else if (status.includes("enroute") || status.includes("airborne"))
                        mappedStatus = "In Progress";
                    else if (status.includes("arrived") || status.includes("landed"))
                        mappedStatus = "Completed";
                    // Step 5: Update UserLeg
                    await pool.request()
                        .input("FitNo", db_1.sql.VarChar, leg.FitNo)
                        .input("status", db_1.sql.VarChar, mappedStatus)
                        .query(`UPDATE UserLeg SET FlightStatus = @status WHERE FitNo = @FitNo`);
                    // Step 6: Insert into UpdateTracking
                    const nextUpdateId = await getNextUpdateId(pool);
                    await pool.request()
                        .input("update_id", db_1.sql.Int, nextUpdateId)
                        .input("update_type_id", db_1.sql.Int, 1)
                        .input("logon", db_1.sql.DateTime, safeDate(flightData.actual_out) ||
                        safeDate(flightData.estimated_out) ||
                        safeDate(flightData.scheduled_out) ||
                        new Date())
                        .input("from_station", db_1.sql.VarChar, flightData.origin?.code)
                        .input("to_station", db_1.sql.VarChar, flightData.destination?.code)
                        .input("packet", db_1.sql.NVarChar, JSON.stringify(flightData))
                        .input("acars_type_id", db_1.sql.Int, 1)
                        .input("update_message", db_1.sql.VarChar, flightData.status)
                        .input("location_id", db_1.sql.Int, 1)
                        .input("timestamp", db_1.sql.DateTime, new Date())
                        .input("flight_number", db_1.sql.VarChar, leg.FitNo)
                        .input("seq_id", db_1.sql.Int, seqNo)
                        .input("tail_number", db_1.sql.VarChar, flightData.registration)
                        .input("crew_swap_flag", db_1.sql.Bit, 0)
                        .input("FaAssignment_type_id", db_1.sql.Int, 1)
                        .input("weather_update", db_1.sql.NVarChar, null)
                        .input("source_api_id", db_1.sql.Int, 1)
                        .query(`
              INSERT INTO UpdateTracking (
                update_id, update_type_id, logon, from_station, to_station,
                packet, acars_type_id, update_message, timestamp, location_id, flight_number,
                seq_id, tail_number, crew_swap_flag, FaAssignment_type_id,
                weather_update, source_api_id
              )
              VALUES (
                @update_id, @update_type_id, @logon, @from_station, @to_station,
                @packet, @acars_type_id, @update_message, @timestamp, @location_id, @flight_number,
                @seq_id, @tail_number, @crew_swap_flag, @FaAssignment_type_id,
                @weather_update, @source_api_id
              )
            `);
                }
            }
        }
        console.log("✅ Flight status cron completed successfully.");
    }
    catch (error) {
        console.error("❌ Error in flight status cron:", error.message || error);
    }
    finally {
        pool.close();
    }
}
/**
 * 🔹 Fetches flight data from FlightAware API
 */
async function fetchFlightData(flightNo, date) {
    const FLIGHTAWARE_BASE_URL = process.env.FLIGHTAWARE_BASE_URL;
    const API_KEY = process.env.FLIGHTAWARE_API_KEY;
    try {
        const start = `${date}T00:00:00Z`;
        const end = `${date}T23:59:59Z`;
        const response = await axios_1.default.get(`${FLIGHTAWARE_BASE_URL}/flights/${flightNo}`, {
            params: { start, end },
            headers: {
                "x-apikey": API_KEY,
                Accept: "application/json",
            },
        });
        return response.data.flights?.[0] || null;
    }
    catch (err) {
        console.error(`⚠️ FlightAware API error for ${flightNo}:`, err.message);
        return null;
    }
}
/**
 * 🔹 Gets next UpdateTracking ID
 */
async function getNextUpdateId(pool) {
    const result = await pool.request().query(`SELECT ISNULL(MAX(update_id), 0) AS maxId FROM UpdateTracking`);
    return result.recordset[0].maxId + 1;
}
/**
 * 🔹 Groups array of objects by field name
 */
function groupBy(array, key) {
    return array.reduce((result, item) => {
        const groupKey = String(item[key]);
        if (!result[groupKey])
            result[groupKey] = [];
        result[groupKey].push(item);
        return result;
    }, {});
}
const safeDate = (dateStr) => {
    if (!dateStr)
        return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};
