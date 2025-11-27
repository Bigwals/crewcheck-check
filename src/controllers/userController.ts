import { Request, Response } from 'express';
import { Messages } from "../constants/responseMessages";
import { StatusCode } from "../constants/statusCodes";
import { resetPasswordSchema } from '../validations/authValidation';
// import { deleteMedia, getUserProfile, uploadMedia } from '../services/authService';
import { deleteFileFromStorage, deleteMedia, updateCrewAvatar, updateCrewReverse, uploadMedia } from '../services/authService';
// import { findUserById, findUserByEmail, findUserAndUpdate } from '../services/userService';
import { findCrewById, findCrewByEmail, getCrewPayDetails, UpdatePassword, findBySequenceNo, findByDateAndSeqNo, getBoardingPayByYears, updatePosition, addSequenceDataInUserSequence, findUserAppliedSequenceNo, addLegDataInUserLeg, getAllCrews, getCrewPayDetail, getUserLanguages, getDynamicBaseRate } from '../services/userServiceNew';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { Sequence } from '../models/Sequence';
import { UserSequence } from '../models/UserSequence';
import { getPool, sql } from "../config/db";
import { findUserById } from '../services/userService';
import { any } from 'zod';
import axios from "axios";
require("dotenv").config()
import { config } from 'dotenv';
import cron from "node-cron";

export const getProfile = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.id;
        const crewId = (req as any).user.crewId;
        // const userId = (req as any).query?.userId;
        console.log("User ==>>", crewId);
        // return res.json({user: crewId});
        // if (!userId || !Types.ObjectId.isValid(crewId)) {
        if (!crewId) {
            return res.status(400).json({ message: "Invalid or missing user ID" });
        }

        const crew = await findCrewById(crewId);

        if (!crew) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

        const service = await getCrewPayDetails(crewId);
        const languages = await getUserLanguages(userId);
        if (service) return res.status(200).json({ message: Messages.USER_PROFILE, crew, languages, service });
        // const crewBases = await getCrewBaseRanking()
        return res.status(200).json({ message: Messages.USER_PROFILE, crew, languages });
    } catch (error: any) {
        console.error("Error in getProfile:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
};

export const getCrewBaseRanking = async (req: Request, res: Response): Promise<any> => {
    try {
        const crewId = (req as any).user.crewId;
        // const crewId = 5896;
        const pool = await getPool();

        // 1) Get logged-in crew
        const fetchBases = await pool
            .request()
            .query(`
                SELECT id, iata_code, name FROM Airports
                WHERE crewbase = 1
            `);
        if (!fetchBases.recordset[0]) {
            return res.status(404).json({ message: "Crew not found" });
        }

        const crew = await findCrewById(crewId)
        // return res.json({ data: crew });
        const crewBases = fetchBases.recordset;

        const baseSeniority = await pool
            .request()
            .input("crewId", sql.Int, crewId) // ✅ You MUST pass this
            .query(`
            SELECT *
            FROM (
                SELECT 
                    CrewID,
                    Base,
                    ROW_NUMBER() OVER (ORDER BY HireDate ASC) AS PositionNumber
                FROM Roster
                WHERE Base = @crew?.Base
            ) AS Ranked
            WHERE CrewID = @crewId;
        `);

        if (!baseSeniority.recordset[0]) {
            return res.status(404).json({ message: "Crew not found" });
        }

        // return res.json({ data: crewBases });
        return res.status(200).json({ message: "Crew Bases Found", crewBases, seniority: crew?.Seniority, baseSeniority, base: crew?.Base });
    } catch (err: any) {
        console.error("Error in getCrewBaseRanking:", err);
        return res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
};
// export const getCrewBaseRanking = async (req: Request, res: Response): Promise<any> => {
//     try {
//         const crewId = (req as any).user.crewId;
//         const pool = await getPool();

//         // 1) Get logged-in crew
//         const crewResult = await pool
//             .request()
//             .input("crewId", sql.Int, crewId)
//             .query(`
//                 SELECT CrewID, Base, OccDate
//                 FROM dbo.Roster
//                 WHERE CrewID = @crewId
//             `);
//         // return res.json({ data: crewResult });
//         if (!crewResult.recordset[0]) {
//             return res.status(404).json({ message: "Crew not found" });
//         }

//         const crew = crewResult.recordset[0];

//         // Logged-in user’s experience
//         const userService = await getCrewPayDetail([crewId]); // pass as array
//         const userExperience = userService[0]?.basePay.YearsOfService ?? 0;

//         // 2) Get all bases from user’s applied sequences
//         const appliedSeqResult = await pool.request()
//             .input("userId", sql.UniqueIdentifier, (req as any).user.id)
//             .query(`
//                 SELECT DISTINCT UL.DeptStn AS Base
//                 FROM dbo.UserSequence US
//                 JOIN dbo.UserLeg UL ON US.UserSequenceID = UL.UserSequenceID
//                 WHERE US.UserID = @userId
//                 UNION
//                 SELECT DISTINCT UL.ArrvStn AS Base
//                 FROM dbo.UserSequence US
//                 JOIN dbo.UserLeg UL ON US.UserSequenceID = UL.UserSequenceID
//                 WHERE US.UserID = @userId
//             `);

//         const flightBases = appliedSeqResult.recordset.map((r: any) => r.Base).filter(Boolean);

//         // Merge primary base with applied sequence bases
//         const allBases = Array.from(new Set([crew.Base, ...flightBases]));

//         // 3) Rankings
//         const rankings = [];

//         for (const base of allBases) {
//             // Get all crew IDs in this base
//             const baseCrewResult = await pool.request()
//                 .input("base", sql.NVarChar, base)
//                 .input("crewId", sql.Int, crewId)
//                 .query(`
//                 SELECT CrewID
//                 FROM dbo.Roster
//                 WHERE Base = @base
//                 UNION
//                 SELECT CrewID
//                 FROM dbo.Roster
//                 WHERE CrewID = @crewId
//             `);

//             const crewIds = baseCrewResult.recordset.map((c: any) => c.CrewID);


//             if (crewIds.length === 0) {
//                 rankings.push({ base, totalMembers: 0, userRank: 0, rankPercent: null });
//                 continue;
//             }

//             const services = await getCrewPayDetail(crewIds);

//             const withExperience = crewIds.map((id, idx) => ({
//                 crewId: id,
//                 experience: services[idx]?.yearsOfService ?? 0, // ✅ use computed years
//             }));

//             // Sort by experience DESC
//             withExperience.sort((a, b) => b.experience - a.experience);

//             const totalMembers = withExperience.length;

//             // Find user rank
//             let userRank = 0;
//             for (let i = 0; i < withExperience.length; i++) {
//                 if (withExperience[i].crewId === crewId) {
//                     userRank = i + 1;
//                     break;
//                 }
//             }

//             const rankPercent = totalMembers > 0
//                 ? ((totalMembers - userRank + 1) / totalMembers) * 100
//                 : null;

//             rankings.push({
//                 base,
//                 totalMembers,
//                 userRank,
//                 rankPercent,
//             });
//         }

//         return res.status(200).json({
//             primaryBase: crew.Base,
//             userExperience,
//             rankings,
//         });
//     } catch (err: any) {
//         console.error("Error in getCrewBaseRanking:", err);
//         return res.status(500).json({ message: "Internal Server Error", error: err.message });
//     }
// };

export const changePassword = async (req: Request, res: Response): Promise<any> => {
    try {
        const { password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.PASSWORD_DOES_NOT_MATCH });
        }
        // return res.json({ crew: crewId })

        const crewId = (req as any).user.crewId;
        // const email = (req as any).user.email;
        // return res.json({ crew: crewId })
        const crew = await findCrewById(crewId);
        // const crew = await findCrewByEmail(email);

        if (!crew) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

        const hashedPassword = await bcrypt.hash(password, Number(process.env.SALT) || 10);
        // crew.password = hashedPassword;
        // await crew.save();
        await UpdatePassword(crewId, hashedPassword)
        return res.status(StatusCode.OK).json({ message: Messages.PASSWORD_CHANGED });
    } catch (error: any) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
}

export const uploadAvatar = async (req: Request, res: Response): Promise<any> => {
    try {
        const crewId = (req as any).user.crewId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const MAX_SIZE = 2 * 1024 * 1024; // 2MB
        if (file.size > MAX_SIZE) {
            return res.status(400).json({ message: 'File is large. Max allowed size is 2MB.' });
        }

        // ✅ Get crew from SQL Server
        const crew = await findCrewById(crewId);
        if (!crew) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

        // ✅ If old avatar exists, delete from storage (optional)
        if (crew.ImageUrl) {
            await deleteFileFromStorage(crew?.ImageUrl);
        }

        // ✅ Update SQL Server with new avatar filename
        const updatedCrew = await updateCrewAvatar(crewId, file.filename);

        return res.status(StatusCode.OK).json({
            message: Messages.AVATAR_UPLOADED,
            user: updatedCrew
        });
    } catch (error: any) {
        console.error("Upload Avatar Error:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};

export const updateReserve = async (req: Request, res: Response): Promise<any> => {
    try {
        const crewId = (req as any).user.crewId;
        const isReserve = req.query.isReverse as string;
        // ✅ Get crew from SQL Server
        const crew = await findCrewById(crewId);
        if (!crew) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

        // ✅ Update SQL Server with new avatar filename
        const updatedCrew = await updateCrewReverse(crewId, isReserve);

        return res.status(StatusCode.OK).json({
            message: Messages.AVATAR_UPLOADED,
            user: updatedCrew
        });
    } catch (error: any) {
        console.error("Upload Avatar Error:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};

export const sequenceWithLegs = async (req: Request, res: Response): Promise<any> => {
    try {
        const seqNo = Number(req.query.seqNo);
        const bidMonth = req.query.bidMonth as string;

        if (!seqNo || isNaN(seqNo)) {
            return res.status(400).json({ message: "seqNo is required and must be numeric" });
        }

        if (!bidMonth) {
            return res.status(400).json({ message: "bidMonth is required" });
        }
        console.time("SQL_TIME");
        // 1️⃣ Fetch sequence data
        const sequenceData = await findBySequenceNo(seqNo, bidMonth);
        if (!sequenceData.length) {
            return res.status(404).json({ message: "No sequence found for the given SeqNo and BidMonth." });
        }

        const pool = await getPool();
        // return res.json({ sequenceData });

        // 2️⃣ Crew service info
        const crewId = (req as any).user?.crewId;
        const service = crewId ? await getCrewPayDetails(crewId) : null;
        const yearsOfService = service?.basePay?.YearsOfService ?? 1;

        const baseRate = await getDynamicBaseRate(yearsOfService);

        // 3️⃣ Dynamic PerDiem rate logic (based on current date)
        // determine per-diem effective Oct1 based on current date (use local now)
        const now = new Date();
        let effectiveYear = now.getFullYear();
        const oct1ThisYear = new Date(`${effectiveYear}-10-01T00:00:00`);
        if (now < oct1ThisYear) effectiveYear -= 1;
        const perDiemEffectiveDate = new Date(`${effectiveYear}-10-01T00:00:00`);

        // fetch the latest PerDiem row whose EffectiveDate <= perDiemEffectiveDate
        const perDiemResult = await pool.request()
            .input("perDiemDate", sql.DateTime, perDiemEffectiveDate)
            .query(`
            SELECT TOP 1 effective_date, dom, int
            FROM PerDiem
            WHERE effective_date <= @perDiemDate
            `);
        // .query(`
        // SELECT TOP 1 EffectiveDate, DOM, INT
        // FROM PerDiem
        // WHERE EffectiveDate <= @perDiemDate

        const perDiemRow = perDiemResult.recordset?.[0] ?? null;
        const perDiem_dom = perDiemRow ? parseFloat(perDiemRow.DOM || 0) : 0;
        const perDiem_int = perDiemRow ? parseFloat(perDiemRow.INT || 0) : 0;

        // 4️⃣ Fetch all legs
        const legsResult = await pool.request()
            .input("seqNo", sql.Int, seqNo)
            .input("bidMonth", sql.NVarChar, bidMonth)
            .query(`SELECT * FROM dbo.Leg WHERE SeqNo = @seqNo AND BidMonth = @bidMonth`);
        const allLegs = legsResult.recordset || [];

        // Helper for date normalization
        const dateKey = (d: any) => {
            if (!d) return "null";
            const date = new Date(d);
            const y = date.getUTCFullYear();
            const m = String(date.getUTCMonth() + 1).padStart(2, "0");
            const day = String(date.getUTCDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
        };

        // 5️⃣ Build final sequences
        const sequences = [];

        for (const seq of sequenceData) {
            // const seqLegs = allLegs.filter(
            //     (l) => l.SeqNo == seq.SeqNo && dateKey(l.EffDate) == dateKey(seq.EffDate)
            // );

            const UniqueSeqNo = seq.UniqueSeqNo;

            const frequency = await pool.request()
                .input("UniqueSeqNo", sql.VarChar, UniqueSeqNo)
                .query(`
            SELECT * FROM Frequency2025
            WHERE unique_seq_no = @UniqueSeqNo
        `);
            const effDates = frequency.recordset || [];

            const seqLegs = allLegs.filter(
                (l) => l.SeqNo == seq.SeqNo && l.BidMonth === seq.BidMonth
            );
            // ---- Handle Calendar_40Day ----
            const calendar = seq.Calendar_40Day || "";
            const flightDays: number[] = [];
            for (let i = 0; i < calendar.length; i++) {
                if (calendar[i] == "1") flightDays.push(i + 1);
            }

            // ✅ Group legs day-wise using EOD flag
            const dayWiseLegs: any[] = [];
            let currentDayLegs: any[] = [];
            let dayCounter = 1;

            seqLegs.forEach((leg: any) => {
                currentDayLegs.push({
                    seqNo: leg.SeqNo,
                    seqLegNo: leg.SeqLegNo,
                    departure: leg.DeptStn,
                    arrival: leg.ArrvStn,
                    flightNo: leg.FitNo,
                    // dptTime: toHHmm(leg.DptTime),
                    // arvTime: toHHmm(leg.ArvTime),
                    dptTime: leg.CvtDptTime,
                    arvTime: leg.CvtArvTime,
                    // dptTime: toDecimalHours(leg.CvtDptTime),
                    // arvTime: toDecimalHours(leg.CvtArvTime),
                    flyingHours: leg.CvtSeqFlyTime ?? leg.LegTotalFlying,
                    legPc: leg.LegPC,
                    layover: leg.Layover ? formatMinutes(leg.Layover) : null,
                    eod: leg.EOD,
                });

                if (leg.EOD == 1) {
                    dayWiseLegs.push({ day: dayCounter, legs: currentDayLegs });
                    currentDayLegs = [];
                    dayCounter++;
                }
            });

            if (currentDayLegs.length > 0)
                dayWiseLegs.push({ day: dayCounter, legs: currentDayLegs });

            // 🧮 Parse "HH:mm" → decimal hours
            const parseTimeToDecimal = (timeStr: any) => {
                if (!timeStr) return 0;
                const [h, m] = String(timeStr).split(":").map(Number);
                return h + (m / 60);
            };

            const cvtSeqPC = toDecimalHours(seq.CvtSeqPC);
            const cvtSeqFlyTime = toDecimalHours(seq.CvtSeqFlyTime);
            const cvtTAFB = toDecimalHours(seq.CvtTAFB);
            // return res.json({ cvtTAFB });
            const cvtSeqPremTime = toDecimalHours(seq.CvtSeqPremTime);

            // 🧾 DPDeadheadTime logic
            const deadheadResult = await pool.request()
                .input("seqNo", sql.Int, seq.SeqNo)
                .query(`
                    SELECT SUM(
                        TRY_CAST(CvtDPDeadheadTime AS FLOAT)
                    ) AS TotalDPDeadheadHours
                    FROM dbo.Leg
                    WHERE SeqNo = @seqNo
                      AND DPDeadheadTime = 1
                `);

            const totalDPDeadheadHours = toDecimalHours(deadheadResult.recordset?.[0]?.TotalDPDeadheadHours ?? 0);

            // 🧮 Calculations
            const payHours = cvtSeqPC + totalDPDeadheadHours;
            const creditHours = cvtSeqFlyTime;
            const tafbHours = cvtTAFB;
            const premiumHours = cvtSeqPremTime;

            const category = seq.SeqCategory?.toUpperCase() ?? "DOM";
            const perDiemRate = seq.SeqCategory === "DOM" ? perDiem_dom : perDiem_int;

            // 🧾 Boarding Pay logic
            const boardingResult = await pool.request()
                .input("YearsOfService", sql.Int, yearsOfService)
                .query(`SELECT TOP 1 * FROM BoardingPay WHERE YearsOfService = @YearsOfService`);

            const boardingRow = boardingResult.recordset?.[0] ?? null;
            let boardingRatePerLeg = 0;
            if (boardingRow) {
                // use the columns you provided in the table
                if (seq.SeqCategory === "DOM") boardingRatePerLeg = parseFloat(boardingRow.Boarding40Min ?? 0);
                else if (seq.SeqCategory === "INT") boardingRatePerLeg = parseFloat(boardingRow.Boarding50Min ?? 0);
                else if (["IPD", "HAW"].includes(seq.SeqCategory)) boardingRatePerLeg = parseFloat(boardingRow.Boarding55Min ?? 0);
                else boardingRatePerLeg = parseFloat(boardingRow.Boarding40Min ?? 0); // fallback
            }

            const numBoardings = parseInt(seq.NBR_Legs ?? String(seqLegs.length ?? 0), 10) || seqLegs.length || 0;
            const totalBoardingPay = parseFloat((boardingRatePerLeg * numBoardings).toFixed(2));

            const boardingPay = totalBoardingPay;

            // 🧮 Premium Pay
            let premiumRate = 0;
            if (category === "IPD") premiumRate = 3.75;
            else if (category === "INT") premiumRate = 3.0;
            else if (category === "SPEAKER") premiumRate = 2.0;

            const payHoursDollars = payHours * baseRate;
            const creditHoursDollars = creditHours * baseRate;
            const tafbPay = tafbHours * perDiemRate;
            const premiumPay = premiumHours * premiumRate;

            const totalEarnings =
                payHoursDollars +
                creditHoursDollars +
                tafbPay +
                premiumPay +
                boardingPay;

            // ✅ Final structured output
            sequences.push({
                seqNo: seq.SeqNo,
                crewBase: seq.CrewBase,
                category: seq.SeqCategory,
                // effDate: seq.EffDate,
                // thruDate: seq.ThruDate,
                effDate: seq.EffDate instanceof Date
                    ? seq.EffDate.toISOString().split("T")[0]
                    : seq.EffDate,
                thruDate: seq.ThruDate instanceof Date
                    ? seq.ThruDate.toISOString().split("T")[0]
                    : seq.ThruDate,
                totalLegs: seq.NBR_Legs,
                totalDays: seq.NBR_Days,
                totalDuty: seq.NBR_Duty,
                seqCrewPos: seq.SeqCrewPos,
                slots: normalizeSeqCrewPos(seq.SeqCrewPos),
                payHours: decimalHoursToHHMM(payHours),
                creditHours: decimalHoursToHHMM(creditHours),
                tafb: decimalHoursToHHMM(tafbHours),
                seqPremiumTime: decimalHoursToHHMM(premiumHours),
                effDates,
                boardingRow,
                flightDays,
                dayWiseLegs,
                earnings: {
                    yearsOfService,
                    baseRate,
                    perDiemRate,
                    tafbHours,
                    tafbPay: tafbPay.toFixed(2),
                    payHoursDollars: payHoursDollars.toFixed(2),
                    creditHoursDollars: creditHoursDollars.toFixed(2),
                    premiumPay: premiumPay.toFixed(2),
                    boardingPay: boardingPay.toFixed(2),
                    totalEarnings: totalEarnings.toFixed(2),
                },
            });
        }
        console.timeEnd("SQL_TIME");

        return res.status(200).json({
            message: "Sequence(s) & legs fetched successfully",
            sequences,
        });

    } catch (error: any) {
        console.error("Error in sequenceWithLegs:", error);
        console.timeEnd("SQL_TIME");
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            message: Messages.INTERNAL_SERVER_ERROR,
            error: error.message,
        });
    }
};

export const sequence = async (req: Request, res: Response): Promise<any> => {
    try {
        // const seqNo = Number(req.query.seqNo);
        const bidMonth = req.query.bidMonth as string;
        const userId = (req as any).user.id;
        const crewId = (req as any).user.crewId;

        // 1) Get UserSequence
        const pool = await getPool();

        const userSeqResult = await pool.request()
            .input("userId", sql.UniqueIdentifier, userId)
            .input("bidMonth", sql.NVarChar, bidMonth)
            .query(`
        SELECT * 
        FROM dbo.UserSequence
        WHERE UserID = @userId
        AND BidMonth = @bidMonth
      `);

        const userSequences = userSeqResult.recordset;
        if (!userSequences || userSequences.length === 0) {
            return res.status(404).json({ message: "No sequence found for this user" });
        }

        // separate current vs previous month sequences
        const currentMonthSeqs = userSequences.filter(s => s.BidMonth === bidMonth);

        // new
        const sequences: any[] = [];

        for (const seq of currentMonthSeqs) {
            const legsResult = await pool.request()
                .input("userSequenceId", sql.UniqueIdentifier, seq.UserSequenceID)
                .query(`
                SELECT *
                FROM dbo.UserLeg
                WHERE UserSequenceID = @userSequenceId
                ORDER BY SeqLegNo ASC
                `);

            const seqLegs = legsResult.recordset || [];

            // ---- Handle Calendar_40Day ----
            const effDate = new Date(seq.EffDate);
            const calendar = seq.Calendar_40Day || "";

            // Identify all flight days (where Calendar_40Day has '1')
            const flightDays: number[] = [];
            for (let i = 0; i < calendar.length; i++) {
                if (calendar[i] === "1") flightDays.push(i + 1);
            }

            // ✅ Step 1: sort legs properly by SeqLegNo
            const sortedLegs = [...seqLegs].sort((a, b) => a.SeqLegNo - b.SeqLegNo);

            // ✅ Step 2: now group them day-wise by EOD
            const dayWiseLegs: any[] = [];
            let currentDayLegs: any[] = [];
            let dayCounter = 1;

            sortedLegs.forEach((leg: any, index: number) => {
                currentDayLegs.push({
                    seqNo: leg.SeqNo,
                    seqLegNo: leg.SeqLegNo,
                    departure: leg.DeptStn,
                    arrival: leg.ArrvStn,
                    flightNo: leg.FitNo,
                    fitLegNo: leg.FitLegNo,
                    // dptTime: toHHmm(leg.DptTime),
                    // arvTime: toHHmm(leg.ArvTime),
                    dptTime: leg.CvtDptTime,
                    arvTime: leg.CvtArvTime,
                    dptZone: leg.DptZone,
                    arvZone: leg.ArvZone,
                    flyingHours: formatMinutes(leg.LegTotalFlying || 0),
                    legPc: leg.LegPC,
                    layover: leg.LayoverTime ? formatMinutes(leg.LayoverTime) : null,
                    eod: leg.EOD
                });

                // If this leg ends the day
                if (leg.EOD == 1) {
                    dayWiseLegs.push({
                        day: dayCounter,
                        legs: currentDayLegs
                    });
                    currentDayLegs = [];
                    dayCounter++;
                }

                // Handle last leg (no EOD=1)
                if (index == sortedLegs.length - 1 && currentDayLegs.length > 0) {
                    dayWiseLegs.push({
                        day: dayCounter,
                        legs: currentDayLegs
                    });
                }
            });

            if (currentDayLegs.length > 0) {
                dayWiseLegs.push({ day: dayCounter, legs: currentDayLegs });
            }

            // ------------------ NEW: Earnings calculation (per your rules) ------------------

            // 1) Base data from UserSequence (these are HOURS as you stated)
            const seqPayHoursHours = toDecimalHours(seq.CvtSeqPC ?? 0);           // hours
            const seqCreditHoursHours = toDecimalHours(seq.CvtSeqFlyTime ?? 0);   // hours
            const seqTafbHours = toDecimalHours(seq.CvtTAFB ?? 0);               // hours
            const seqPremiumHours = toDecimalHours(seq.CvtSeqPremTime ?? 0);     // hours

            // 2) DPDeadheadTime is stored in UserLeg. If any leg has DPDeadheadTime = 1,
            //    sum CvtDPDeadheadTime for those legs and add to seqPayHoursHours
            const deadheadResult = await pool.request()
                .input("userSequenceId", sql.UniqueIdentifier, seq.UserSequenceID)
                .query(`
                SELECT 
                SUM(TRY_CAST(CvtDPDeadheadTime AS FLOAT)) AS TotalDPDeadheadHours
                FROM dbo.UserLeg
                WHERE UserSequenceID = @userSequenceId
                AND DPDeadheadTime = 1
            `);

            const totalDPDeadheadHours = toDecimalHours(deadheadResult.recordset?.[0]?.TotalDPDeadheadHours) || 0;

            // final pay hours (hours) = seq.CvtSeqPC + DPDeadhead (only when DPDeadheadTime present)
            const payHoursHours = seqPayHoursHours + totalDPDeadheadHours;

            // 3) Get crew/service & base rate (getDynamicBaseRate must NOT use seq.EffDate)
            const service = crewId ? await getCrewPayDetails(crewId) : null;
            const yearsOfService = service?.basePay?.YearsOfService ?? 1;
            const baseRate = await getDynamicBaseRate(yearsOfService); // $ per hour

            // ================================
            // PERDIEM LOOKUP - BASED ON CURRENT DATE window (10/1/<Y> - 9/30/<Y+1>)
            // ================================
            const now = new Date();
            let effectiveYear = now.getFullYear();
            const oct1ThisYear = new Date(`${effectiveYear}-10-01T00:00:00Z`);
            if (now < oct1ThisYear) {
                effectiveYear = effectiveYear - 1;
            }
            // per-diem effective date we want (10/1/<effectiveYear>)
            const perDiemEffectiveDate = new Date(`${effectiveYear}-10-01T00:00:00Z`);

            const perDiemResult = await pool.request()
                .input("perDiemDate", sql.DateTime, perDiemEffectiveDate)
                .query(`
                SELECT TOP 1 effective_date, dom, int
                FROM PerDiem
                WHERE effective_date <= @perDiemDate
                `);
            // SELECT TOP 1 DOM, INT
            // FROM PerDiem
            // WHERE EffectiveDate <= @perDiemDate

            const perDiemRow = perDiemResult.recordset?.[0] ?? { DOM: 0, INT: 0 };
            let perDiemRate = 0;
            if (seq.SeqCategory === "DOM") {
                perDiemRate = parseFloat(perDiemRow.DOM ?? 0);
            } else if (["IPD", "HAW", "INT"].includes(seq.SeqCategory)) {
                perDiemRate = parseFloat(perDiemRow.INT ?? 0);
            } else {
                perDiemRate = 0;
            }
            // ================================

            // 5) BoardingPay: fetch by YearsOfService
            const boardingResult = await pool.request()
                .input("YearsOfService", sql.Int, yearsOfService)
                .query(`SELECT TOP 1 * FROM BoardingPay WHERE YearsOfService = @YearsOfService`);

            const boardingRow = boardingResult.recordset?.[0] ?? null;

            // choose boarding rate value depending on SeqCategory (these columns hold $ amounts per boarding)
            let boardingRatePerLeg = 0;
            if (boardingRow) {
                if (seq.SeqCategory === "DOM") boardingRatePerLeg = parseFloat(boardingRow.Boarding40Min ?? 0);
                else if (seq.SeqCategory === "INT") boardingRatePerLeg = parseFloat(boardingRow.Boarding50Min ?? 0);
                else if (["IPD", "HAW"].includes(seq.SeqCategory)) boardingRatePerLeg = parseFloat(boardingRow.Boarding55Min ?? 0);
                else boardingRatePerLeg = parseFloat(boardingRow.Boarding40Min ?? 0); // fallback
            }

            // number of boardings: prefer NBR_Legs if present, otherwise seqLegs.length
            const numBoardings = parseFloat(seq.NBR_Legs ?? seqLegs.length ?? 0);
            const totalBoardingPay = parseFloat((boardingRatePerLeg * (numBoardings || 0)).toFixed(2));


            // 6) Premium pay rules (per your doc)
            let premiumRatePerHour = 0;
            if (seq.SeqCategory === "IPD") premiumRatePerHour = 3.75;
            else if (seq.SeqCategory === "INT") premiumRatePerHour = 3.00;
            else if (seq.SeqCategory === "SPEAKER") premiumRatePerHour = 2.00;
            else premiumRatePerHour = 0;             // TAFB $

            const payHoursDollars = parseFloat((payHoursHours * (baseRate || 0)).toFixed(2));
            const creditHoursDollars = parseFloat((seqCreditHoursHours * (baseRate || 0)).toFixed(2));
            const tafbPay = parseFloat((seqTafbHours * (perDiemRate || 0)).toFixed(2));
            const premiumPay = parseFloat((seqPremiumHours * (premiumRatePerHour || 0)).toFixed(2));

            // 8) Total sequence earnings
            const totalSequenceEarnings = Number(
                payHoursDollars + creditHoursDollars + tafbPay + premiumPay + totalBoardingPay
            );

            // 9) Prepare the same output shape as before (frontend unchanged).
            //    formatMinutes() in your code expects minutes, so convert hours->minutes for formatting fields.
            sequences.push({
                ...seq,
                lastArrvStn: seqLegs.length > 0 ? seqLegs[seqLegs.length - 1].ArrvStn : null,
                slots: normalizeSeqCrewPos(seq.SeqCrewPos),

                // format fields: convert hours -> minutes for formatMinutes/toHHmm
                payHours: formatMinutes(Math.round(payHoursHours * 60)),               // "HH:mm"
                creditHours: formatMinutes(Math.round(seqCreditHoursHours * 60)),      // "HH:mm"
                tafb: formatMinutes(Math.round(seqTafbHours * 60)),                   // "HH:mm"
                seqPremiumTime: toHHmm(Math.round(seqPremiumHours * 60)),             // "HH:mm"

                // Day/flight info unchanged
                totalFlyingDays: flightDays.length,
                flightDays,
                dayWiseLegs,

                earnings: {
                    yearsOfService,
                    baseRate,                       // $/hour
                    perDiemRate,                    // $ per hour (per-diem)
                    tafHours: seqTafbHours,
                    tafPerDiem: tafbPay.toFixed(2),
                    payHoursHours,                   // hours (raw)
                    totalDPDeadheadHours,            // hours added from legs
                    payHoursDollars: payHoursDollars.toFixed(2),
                    creditHoursDollars: creditHoursDollars.toFixed(2),
                    premiumPay: premiumPay.toFixed(2),
                    totalBoardingPay: totalBoardingPay.toFixed(2),
                    totalSequenceEarnings: totalSequenceEarnings.toFixed(2)
                },

                legs: seqLegs.map((leg: any) => ({
                    seqNo: leg.SeqNo,
                    seqLegNo: leg.SeqLegNo,
                    departure: leg.DeptStn,
                    arrival: leg.ArrvStn,
                    flightNo: leg.FitNo,
                    // dptTime: toHHmm(leg.DptTime),
                    // arvTime: toHHmm(leg.ArvTime),
                    dptTime: leg.CvtDptTime,
                    arvTime: leg.CvtArvTime,
                    flyingHours: formatMinutes(leg.LegTotalFlying),
                    legPc: leg.LegPC,
                    layover: leg.LayoverTime ? formatMinutes(leg.LayoverTime) : null,
                    eod: leg.EOD
                }))
            });
        } // end for each seq

        // -------------------- (the remainder of your original function is unchanged) --------------------

        // 3) Now calculate earnings summary
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // new 
        const upcomingSequences = sequences.filter(s => new Date(s.EffDate) >= today);
        const completedSequences = sequences.filter(s => new Date(s.EffDate) < today);

        // ✅ Total = sum of all upcoming sequences
        const totalEarnings = upcomingSequences.reduce(
            (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0),
            0
        );

        let upcomingEarnings = 0;
        let payHours = '';
        let creditHours = '';
        let tafb = '';
        let seqPremiumTime = '';
        let boardings = 0;

        let completedSequencesTotalEarnings = 0;

        // ✅ Calculate all completed sequences total (always)
        completedSequencesTotalEarnings = completedSequences.reduce(
            (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0),
            0
        );

        if (upcomingSequences.length > 0) {
            // 🔹 Sum total earnings across all upcoming sequences
            const totalUpcomingEarnings = upcomingSequences.reduce(
                (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0),
                0
            );

            const parseFormattedMinutes = (formatted: string): number => {
                if (!formatted) return 0;
                const match = formatted.match(/(\d+):(\d+)/);
                if (!match) return 0;
                const h = parseInt(match[1], 10);
                const m = parseInt(match[2], 10);
                return h * 60 + m;
            };

            // 🔹 Sum all minutes for pay, credit, tafb
            const totalPayMinutes = upcomingSequences.reduce(
                (sum, s) => sum + parseFormattedMinutes(s.payHours),
                0
            );
            const totalCreditMinutes = upcomingSequences.reduce(
                (sum, s) => sum + parseFormattedMinutes(s.creditHours),
                0
            );
            const totalTafbMinutes = upcomingSequences.reduce(
                (sum, s) => sum + parseFormattedMinutes(s.tafb),
                0
            );
            const totlaSeqPremiumTime = upcomingSequences.reduce(
                (sum, s) => sum + parseFormattedMinutes(s.seqPremiumTime),
                0
            );

            // 🔹 Optional: sum total number of legs (boardings)
            const totalBoardings = upcomingSequences.reduce(
                (sum, s) => sum + (s.NBR_Legs ?? 0),
                0
            );

            // 🔹 Format totals back to readable strings
            payHours = formatMinutes(totalPayMinutes);
            creditHours = formatMinutes(totalCreditMinutes);
            tafb = formatMinutes(totalTafbMinutes);
            seqPremiumTime = formatMinutes(totlaSeqPremiumTime)
            boardings = totalBoardings;
            upcomingEarnings = totalUpcomingEarnings.toFixed(2);
        }

        let completedPayHours = '';
        let completedCreditHours = '';
        let completedTafb = '';
        let completedSeqPremiumTime = '';
        let completedBoardings = 0;

        if (completedSequences.length > 0) {
            const parseFormattedMinutes = (formatted: string): number => {
                if (!formatted) return 0;
                const match = formatted.match(/(\d+):(\d+)/);
                if (!match) return 0;
                const h = parseInt(match[1], 10);
                const m = parseInt(match[2], 10);
                return h * 60 + m;
            };

            const completedPayHoursTotal = completedSequences.reduce(
                (sum, s) => sum + parseFormattedMinutes(s.payHours || 0),
                0
            );
            const completedCreditHoursTotal = completedSequences.reduce(
                (sum, s) => sum + parseFormattedMinutes(s.creditHours || 0),
                0
            );
            const completedTafbTotal = completedSequences.reduce(
                (sum, s) => sum + parseFormattedMinutes(s.tafb || 0),
                0
            );
            const completedSeqPremiumTimeTotal = completedSequences.reduce(
                (sum, s) => sum + parseFormattedMinutes(s.seqPremiumTime || 0),
                0
            );

            completedBoardings = completedSequences.reduce(
                (sum, s) => sum + (s.NBR_Legs ?? 0),
                0
            );

            completedPayHours = formatMinutes(completedPayHoursTotal);
            completedCreditHours = formatMinutes(completedCreditHoursTotal);
            completedTafb = formatMinutes(completedTafbTotal);
            completedSeqPremiumTime = formatMinutes(completedSeqPremiumTimeTotal);
        }

        // last completed earnings
        let lastCompletedEarnings = 0;
        if (completedSequences.length > 0) {
            const lastCompletedSeq = completedSequences.sort(
                (a, b) => new Date(b.EffDate).getTime() - new Date(a.EffDate).getTime()
            )[0];
            lastCompletedEarnings = parseFloat(lastCompletedSeq.earnings.totalSequenceEarnings);
        }

        // Helper: convert "HH:mm" → total minutes
        const parseTimeToMinutes = (formatted: string): number => {
            if (!formatted) return 0;
            const match = formatted.match(/(\d+):(\d+)/);
            if (!match) return 0;
            const h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            return h * 60 + m;
        };

        // Combine upcoming + completed earnings and times
        const combinedPayMinutes =
            parseTimeToMinutes(payHours) + parseTimeToMinutes(completedPayHours);
        const combinedCreditMinutes =
            parseTimeToMinutes(creditHours) + parseTimeToMinutes(completedCreditHours);
        const combinedTafbMinutes =
            parseTimeToMinutes(tafb) + parseTimeToMinutes(completedTafb);
        const combinedSeqPremiumMinutes =
            parseTimeToMinutes(seqPremiumTime) + parseTimeToMinutes(completedSeqPremiumTime);

        // Combine boardings
        const combinedBoardings = (boardings ?? 0) + (completedBoardings ?? 0);

        // Combine earnings
        const combinedTotalEarnings =
            (totalEarnings ?? 0) + (completedSequencesTotalEarnings ?? 0);

        // Final summaries
        const completedSequencesEarningsSummary = {
            total: completedSequencesTotalEarnings,
            lastCompleted: lastCompletedEarnings,
            completedPayHours,
            completedCreditHours,
            completedTafb,
            completedSeqPremiumTime,
            completedBoardings
        };

        const earningsSummary = {
            payHours: formatMinutes(combinedPayMinutes),
            creditHours: formatMinutes(combinedCreditMinutes),
            tafb: formatMinutes(combinedTafbMinutes),
            seqPremiumTime: formatMinutes(combinedSeqPremiumMinutes),
            boardings: combinedBoardings,
            upcoming: upcomingEarnings,
            total: totalEarnings,
            display: combinedTotalEarnings.toFixed(2)
        };

        // Send response (unchanged shape)
        return res.status(200).json({
            message: "User Sequence Data with User Legs",
            earningsSummary,
            completedSequencesEarningsSummary,
            completedSequences,
            upcomingSequences
        });

    } catch (error: any) {
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
};

export const filterByDate = async (req: Request, res: Response): Promise<any> => {
    try {
        const seqNo = Number(req.query.seqNo);
        const effDates = new Date(req.query.effDate as string);
        // const effDate = req.query.effDate as string; // "2025-11-17"
        const effDate = (req.query.effDate as string).split("T")[0];

        if (!seqNo || isNaN(seqNo)) {
            return res.status(400).json({ message: "seqNo is required and must be numeric" });
        }
        if (!req.query.effDate) {
            return res.status(400).json({ message: "effDate is required" });
        }

        const data = await findByDateAndSeqNo(seqNo, effDate);
        console.log("Eff Date", effDate)
        console.log("Eff Dates", effDates)

        if (!data) {
            return res.status(404).json({ message: "No legs found for given seqNo and effDate" });
        }

        // let noOfBoardings = 0;
        // Prepare UI-ready leg summary
        const formatted = data.map(leg => ({
            seqNo: leg.SeqNo,
            seqLegNo: leg.SeqLegNo,
            departure: leg.DeptStn,
            arrival: leg.ArrvStn,
            flightNo: leg.FitNo,
            // dptTime: toHHmm(leg.DptTime),
            // arvTime: toHHmm(leg.ArvTime),
            dptTime: leg.CvtDptTime,
            arvTime: leg.CvtArvTime,
            flyingHours: formatMinutes(leg.LegTotalFlying),
            pc: leg.LegPC,
            // boardingTime: calculateBoardingTime(leg.DptTime ),
            // boardingTime: toHHmm(leg.DptTime - 30),
            layover: leg.Layover ? formatMinutes(leg.Layover) : null,
            eod: leg.EOD
        }));

        return res.status(200).json({
            message: "Legs Fetched Successfully",
            sequence: formatted,
        });
    } catch (error: any) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            message: Messages.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};

export const applyPosition = async (req: Request, res: Response): Promise<any> => {
    try {
        const { seqNo, position, effDate, bidMonth } = req.body;
        const userId = (req as any).user.id
        if (!seqNo || !position) {
            return res.status(StatusCode.BAD_REQUEST).json({ message: "seqNo and position are required" });
        }

        // const updatedSeqCrewPos = await updatePosition(Number(seqNo), Number(position), effDate);
        const updatedSeqCrewPos = await updatePosition(Number(seqNo), Number(position), bidMonth);

        if (!updatedSeqCrewPos) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

        const newUserSequenceId = await addSequenceDataInUserSequence(userId, updatedSeqCrewPos, position, effDate, updatedSeqCrewPos.originalDigit);
        const newUserLegId = await addLegDataInUserLeg(seqNo, effDate, newUserSequenceId);

        return res.status(StatusCode.OK).json({
            message: "Position Applied Successfully",
            updatedSeqCrewPos
        });

    } catch (error: any) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            message: Messages.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};

export const basePay = async (req: Request, res: Response): Promise<any> => {
    try {
        const crewId = (req as any).user.crewId;

        const service = await getCrewPayDetails(crewId);

        let pay = await getDynamicBaseRate(service.basePay.YearsOfService);

        const understaffingPayRate = 10.50;

        const domesticPayRate = 2.5;
        const internationalPayRate = 3.75;

        const boardingPayRate = await getBoardingPayByYears(service.basePay.YearsOfService);
        // return res.json({ boardingPay: boardingPayRate });
        const ipdRate = 3.00;
        const nipsRate = 2.85;
        const speakerRate = 2.00;
        const speakerIntNipdRate = 3.00;
        const speakerIpdRate = 3.75;

        const regularPayRates = {
            basePay: pay,
            rigPay: pay,
            sickPay: 0,
            vacationPay: pay,
            holidayPay: pay,
            jurydutyPay: 0,
            understaffingPay: understaffingPayRate,
            hotel1HourDelayPay: "100% of Same Day Trips",
            hotel3HoursDelayPay: "100% of Full Sequence",
            standbyPay: pay,
        }

        const perDiems = {
            domesticRate: domesticPayRate,
            internationalRate: internationalPayRate
        }

        const boardingPay = {
            min40: boardingPayRate?.Boarding40Min,
            min45: boardingPayRate?.Boarding45Min,
            min55: boardingPayRate?.Boarding55Min
        }

        const premiumPay = {
            ipd: ipdRate,
            nips: nipsRate,
            speaker: speakerRate,
            speakerIntNipd: speakerIntNipdRate,
            speakerIpd: speakerIpdRate
        }

        return res.status(200).json({ message: "Base Pay Data", service, regularPayRates, perDiems, boardingPay, premiumPay });

    } catch (error: any) {
        console.error("Error in getProfile:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
}

export const deleteSequence = async (req: Request, res: Response): Promise<any> => {
    try {
        const { userId, seqNo, bidMonth } = req.body;

        if (!userId || !seqNo || !bidMonth) {
            return res
                .status(StatusCode.BAD_REQUEST)
                .json({ message: "userId, seqNo, and bidMonth are required." });
        }

        const pool = await getPool();

        // Step 1: Fetch the UserSequence record (we need the PositionAppliedOn)
        const { recordset: sequenceResult } = await pool
            .request()
            .input("UserID", userId)
            .input("SeqNo", seqNo)
            .input("BidMonth", bidMonth)
            .query(`
        SELECT TOP 1 UserSequenceID, PositionAppliedOn
        FROM UserSequence 
        WHERE UserID = @UserID AND SeqNo = @SeqNo AND BidMonth = @BidMonth
      `);

        if (sequenceResult.length === 0) {
            return res
                .status(StatusCode.NOT_FOUND)
                .json({ message: "No sequence found for this user." });
        }

        const userSequenceId = sequenceResult[0].UserSequenceID;
        const positionAppliedOn = sequenceResult[0].PositionAppliedOn;

        // Step 2: Begin transaction
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Step 3: Fetch the current SeqCrewPos for this sequence
            const { recordset: seqData } = await transaction
                .request()
                .input("SeqNo", seqNo)
                .input("BidMonth", bidMonth)
                .query(`
          SELECT SeqCrewPos 
          FROM Sequence 
          WHERE SeqNo = @SeqNo AND BidMonth = @BidMonth
        `);

            if (seqData.length > 0) {
                let seqCrewPos = seqData[0].SeqCrewPos;
                let seqCrewPosArr = seqCrewPos.split("");

                // Step 4: Revert that position back to "1" (make it available again)
                if (positionAppliedOn > 0 && positionAppliedOn <= seqCrewPosArr.length) {
                    seqCrewPosArr[positionAppliedOn - 1] = "1";
                }

                const updatedSeqCrewPos = seqCrewPosArr.join("");

                // Step 5: Update Sequence table
                await transaction
                    .request()
                    .input("SeqNo", seqNo)
                    .input("BidMonth", bidMonth)
                    .input("SeqCrewPos", sql.NVarChar, updatedSeqCrewPos)
                    .query(`
            UPDATE Sequence
            SET SeqCrewPos = @SeqCrewPos
            WHERE SeqNo = @SeqNo AND BidMonth = @BidMonth
          `);
            }

            // Step 6: Delete associated UserLegs
            await transaction
                .request()
                .input("UserSequenceID", userSequenceId)
                .query(`DELETE FROM UserLeg WHERE UserSequenceID = @UserSequenceID`);

            // Step 7: Delete the UserSequence
            await transaction
                .request()
                .input("UserSequenceID", userSequenceId)
                .query(`DELETE FROM UserSequence WHERE UserSequenceID = @UserSequenceID`);

            // Step 8: Commit transaction
            await transaction.commit();

            console.log(`✅ Sequence ${userSequenceId} deleted and position reverted successfully.`);

            return res.status(StatusCode.OK).json({
                message: "Sequence deleted and position made available again."
            });

        } catch (innerError: any) {
            await transaction.rollback();
            console.error("❌ Transaction rolled back:", innerError);
            return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Internal Server Error",
                error: innerError.message
            });
        }

    } catch (error: any) {
        console.error("Error in deleteSequence:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
};

// === API endpoint to test manually in Postman ===

// new
export const getStubs = async (req: Request, res: Response): Promise<any> => {
    try {
        const { flightNumber, date } = req.params; // e.g., "UAL4", "2025-10-05"
        if (!flightNumber || !date) {
            return res.status(400).json({ success: false, message: "flightNumber and date are required" });
        }

        // const FLIGHTAWARE_BASE_URL = "https://aeroapi.flightaware.com/aeroapi";
        const FLIGHTAWARE_BASE_URL = process.env.FLIGHTAWARE_BASE_URL;
        const API_KEY = process.env.FLIGHTAWARE_API_KEY;

        const start = `${date}T00:00:00Z`;
        const end = `${date}T23:59:59Z`;

        const response = await axios.get(`${FLIGHTAWARE_BASE_URL}/flights/${flightNumber}`, {
            params: { start, end },
            headers: {
                "x-apikey": API_KEY,
                "Accept": "application/json",
            },
        });

        return res.status(200).json({
            success: true,
            message: "Flight stubs fetched successfully",
            data: response.data.flights || [],
        });

    } catch (error: any) {
        console.error("Error fetching flight stubs:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to fetch flight stubs",
            error: error.response?.data || error.message,
        });
    }
};

// helper functions
const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${m}`;
}

const toHHmm = (time: number): string => {
    const hh = Math.floor(time / 60);
    const mm = time % 60;
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
};

const decimalHoursToHHMM = (decimalHours: number): string => {
    const totalMinutes = Math.round(decimalHours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${String(m).padStart(2, "0")}`;
};

const toDecimalHours = (value: string | number | null | undefined): number => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const parts = value.split(":");
        const h = parseInt(parts[0] || "0", 10);
        const m = parseInt(parts[1] || "0", 10);
        return h + m / 60;
    }
    return 0;
};
// ---------- helpers ----------

const formatHHMMFromDecimal = (hoursDecimal: number): string => {
    const h = Math.floor(hoursDecimal);
    const m = Math.round((hoursDecimal - h) * 60);
    return `${h}:${String(m).padStart(2, "0")}`;
};
// ---------- end helpers ----------

const normalizeSeqCrewPos = (seqCrewPos: string): boolean[] => {
    if (!seqCrewPos) return [];
    return seqCrewPos.split("").map(ch => ch === "1");
};

// converts departure minutes to boarding minutes (subtracts 30min safely)
const calculateBoardingTime = (dptTime: number): number => {
    let boarding = dptTime - 30;
    if (boarding < 0) {
        boarding = 1440 + boarding; // wrap around if it goes before midnight
    }
    return boarding;
};

