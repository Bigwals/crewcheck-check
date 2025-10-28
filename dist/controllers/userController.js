"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStubs = exports.deleteSequence = exports.basePay = exports.applyPosition = exports.filterByDate = exports.sequence = exports.sequenceWithLegs = exports.updateReserve = exports.uploadAvatar = exports.changePassword = exports.getCrewBaseRanking = exports.getProfile = void 0;
const responseMessages_1 = require("../constants/responseMessages");
const statusCodes_1 = require("../constants/statusCodes");
// import { deleteMedia, getUserProfile, uploadMedia } from '../services/authService';
const authService_1 = require("../services/authService");
// import { findUserById, findUserByEmail, findUserAndUpdate } from '../services/userService';
const userServiceNew_1 = require("../services/userServiceNew");
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = require("../config/db");
const axios_1 = __importDefault(require("axios"));
require("dotenv").config();
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const crewId = req.user.crewId;
        // const userId = (req as any).query?.userId;
        console.log("User ==>>", crewId);
        // return res.json({user: crewId});
        // if (!userId || !Types.ObjectId.isValid(crewId)) {
        if (!crewId) {
            return res.status(400).json({ message: "Invalid or missing user ID" });
        }
        const crew = await (0, userServiceNew_1.findCrewById)(crewId);
        if (!crew) {
            return res.status(statusCodes_1.StatusCode.NOT_FOUND).json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        const service = await (0, userServiceNew_1.getCrewPayDetails)(crewId);
        const languages = await (0, userServiceNew_1.getUserLanguages)(userId);
        if (service)
            return res.status(200).json({ message: responseMessages_1.Messages.USER_PROFILE, crew, languages, service });
        // const crewBases = await getCrewBaseRanking()
        return res.status(200).json({ message: responseMessages_1.Messages.USER_PROFILE, crew, languages });
    }
    catch (error) {
        console.error("Error in getProfile:", error);
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
};
exports.getProfile = getProfile;
// new
const getCrewBaseRanking = async (req, res) => {
    try {
        const crewId = req.user.crewId;
        const pool = await (0, db_1.getPool)();
        // 1) Get logged-in crew
        const crewResult = await pool
            .request()
            .input("crewId", db_1.sql.Int, crewId)
            .query(`
                SELECT CrewID, Base, OccDate
                FROM dbo.Roster
                WHERE CrewID = @crewId
            `);
        // return res.json({ data: crewResult });
        if (!crewResult.recordset[0]) {
            return res.status(404).json({ message: "Crew not found" });
        }
        const crew = crewResult.recordset[0];
        // Logged-in user’s experience
        const userService = await (0, userServiceNew_1.getCrewPayDetail)([crewId]); // pass as array
        const userExperience = userService[0]?.basePay.YearsOfService ?? 0;
        // 2) Get all bases from user’s applied sequences
        const appliedSeqResult = await pool.request()
            .input("userId", db_1.sql.UniqueIdentifier, req.user.id)
            .query(`
                SELECT DISTINCT UL.DeptStn AS Base
                FROM dbo.UserSequence US
                JOIN dbo.UserLeg UL ON US.UserSequenceID = UL.UserSequenceID
                WHERE US.UserID = @userId
                UNION
                SELECT DISTINCT UL.ArrvStn AS Base
                FROM dbo.UserSequence US
                JOIN dbo.UserLeg UL ON US.UserSequenceID = UL.UserSequenceID
                WHERE US.UserID = @userId
            `);
        const flightBases = appliedSeqResult.recordset.map((r) => r.Base).filter(Boolean);
        // Merge primary base with applied sequence bases
        const allBases = Array.from(new Set([crew.Base, ...flightBases]));
        // 3) Rankings
        const rankings = [];
        for (const base of allBases) {
            // Get all crew IDs in this base
            // const baseCrewResult = await pool.request()
            //     .input("base", sql.NVarChar, base)
            //     .query(`
            //         SELECT CrewID
            //         FROM dbo.Roster
            //         WHERE Base = @base
            //     `);
            // const crewIds = baseCrewResult.recordset.map((c: any) => c.CrewID);
            const baseCrewResult = await pool.request()
                .input("base", db_1.sql.NVarChar, base)
                .input("crewId", db_1.sql.Int, crewId)
                .query(`
                SELECT CrewID
                FROM dbo.Roster
                WHERE Base = @base
                UNION
                SELECT CrewID
                FROM dbo.Roster
                WHERE CrewID = @crewId
            `);
            const crewIds = baseCrewResult.recordset.map((c) => c.CrewID);
            if (crewIds.length === 0) {
                rankings.push({ base, totalMembers: 0, userRank: 0, rankPercent: null });
                continue;
            }
            // 🚀 Bulk fetch all experiences at once
            // const services = await getCrewPayDetail(crewIds);
            // const withExperience = crewIds.map((id, idx) => ({
            //     crewId: id,
            //     experience: services[idx]?.basePay.YearsOfService ?? 0,
            // }));
            const services = await (0, userServiceNew_1.getCrewPayDetail)(crewIds);
            const withExperience = crewIds.map((id, idx) => ({
                crewId: id,
                experience: services[idx]?.yearsOfService ?? 0, // ✅ use computed years
            }));
            // Sort by experience DESC
            withExperience.sort((a, b) => b.experience - a.experience);
            const totalMembers = withExperience.length;
            // Find user rank
            let userRank = 0;
            for (let i = 0; i < withExperience.length; i++) {
                if (withExperience[i].crewId === crewId) {
                    userRank = i + 1;
                    break;
                }
            }
            // const rankPercent = totalMembers > 0
            //     ? Math.round(((totalMembers - userRank + 1) / totalMembers) * 100)
            //     : null;
            const rankPercent = totalMembers > 0
                ? ((totalMembers - userRank + 1) / totalMembers) * 100
                : null;
            rankings.push({
                base,
                totalMembers,
                userRank,
                rankPercent,
            });
        }
        return res.status(200).json({
            primaryBase: crew.Base,
            userExperience,
            rankings,
        });
    }
    catch (err) {
        console.error("Error in getCrewBaseRanking:", err);
        return res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
};
exports.getCrewBaseRanking = getCrewBaseRanking;
const changePassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        if (password !== confirmPassword) {
            return res.status(statusCodes_1.StatusCode.BAD_REQUEST).json({ message: responseMessages_1.Messages.PASSWORD_DOES_NOT_MATCH });
        }
        // return res.json({ crew: crewId })
        const crewId = req.user.crewId;
        // const email = (req as any).user.email;
        // return res.json({ crew: crewId })
        const crew = await (0, userServiceNew_1.findCrewById)(crewId);
        // const crew = await findCrewByEmail(email);
        if (!crew) {
            return res.status(statusCodes_1.StatusCode.NOT_FOUND).json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, Number(process.env.SALT) || 10);
        // crew.password = hashedPassword;
        // await crew.save();
        await (0, userServiceNew_1.UpdatePassword)(crewId, hashedPassword);
        return res.status(statusCodes_1.StatusCode.OK).json({ message: responseMessages_1.Messages.PASSWORD_CHANGED });
    }
    catch (error) {
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
};
exports.changePassword = changePassword;
// userController.ts
const uploadAvatar = async (req, res) => {
    try {
        const crewId = req.user.crewId;
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB
        if (file.size > MAX_SIZE) {
            return res.status(400).json({ message: 'File is large. Max allowed size is 2MB.' });
        }
        // ✅ Get crew from SQL Server
        const crew = await (0, userServiceNew_1.findCrewById)(crewId);
        if (!crew) {
            return res.status(statusCodes_1.StatusCode.NOT_FOUND).json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        // ✅ If old avatar exists, delete from storage (optional)
        if (crew.ImageUrl) {
            await (0, authService_1.deleteFileFromStorage)(crew?.ImageUrl);
        }
        // ✅ Update SQL Server with new avatar filename
        const updatedCrew = await (0, authService_1.updateCrewAvatar)(crewId, file.filename);
        return res.status(statusCodes_1.StatusCode.OK).json({
            message: responseMessages_1.Messages.AVATAR_UPLOADED,
            user: updatedCrew
        });
    }
    catch (error) {
        console.error("Upload Avatar Error:", error);
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};
exports.uploadAvatar = uploadAvatar;
const updateReserve = async (req, res) => {
    try {
        const crewId = req.user.crewId;
        const isReserve = req.query.isReverse;
        // ✅ Get crew from SQL Server
        const crew = await (0, userServiceNew_1.findCrewById)(crewId);
        if (!crew) {
            return res.status(statusCodes_1.StatusCode.NOT_FOUND).json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        // ✅ Update SQL Server with new avatar filename
        const updatedCrew = await (0, authService_1.updateCrewReverse)(crewId, isReserve);
        return res.status(statusCodes_1.StatusCode.OK).json({
            message: responseMessages_1.Messages.AVATAR_UPLOADED,
            user: updatedCrew
        });
    }
    catch (error) {
        console.error("Upload Avatar Error:", error);
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};
exports.updateReserve = updateReserve;
// new
const sequenceWithLegs = async (req, res) => {
    try {
        const seqNo = Number(req.query.seqNo);
        const bidMonth = req.query.bidMonth;
        if (!seqNo || isNaN(seqNo)) {
            return res.status(400).json({ message: "seqNo is required and must be numeric" });
        }
        if (!bidMonth) {
            return res.status(400).json({ message: "bidMonth is required" });
        }
        // 1️⃣ Fetch sequence data
        const sequenceData = await (0, userServiceNew_1.findBySequenceNo)(seqNo, bidMonth);
        // 2️⃣ Crew service info
        const crewId = req.user?.crewId;
        const service = crewId ? await (0, userServiceNew_1.getCrewPayDetails)(crewId) : null;
        const yearsOfService = service?.basePay?.YearsOfService ?? 1;
        // 3️⃣ Base pay & per diem rates
        const basePayMap = {
            1: 35.82, 2: 37.97, 3: 40.40, 4: 43.03, 5: 47.39,
            6: 53.67, 7: 59.21, 8: 61.11, 9: 62.80, 10: 65.15,
            11: 66.94, 12: 70.12, 13: 82.24
        };
        const baseRate = basePayMap[yearsOfService] ?? 0;
        const perDiemRates = {
            DOM: 2.5,
            INT: 3.75
        };
        // 4️⃣ Fetch all legs
        const pool = await (0, db_1.getPool)();
        const legsResult = await pool.request()
            .input("seqNo", db_1.sql.Int, seqNo)
            .input("bidMonth", db_1.sql.NVarChar, bidMonth)
            .query(`SELECT * FROM dbo.Leg WHERE SeqNo = @seqNo AND BidMonth = @bidMonth`);
        const allLegs = legsResult.recordset || [];
        // Helper for date normalization
        const dateKey = (d) => {
            if (!d)
                return "null";
            const date = new Date(d);
            const y = date.getUTCFullYear();
            const m = String(date.getUTCMonth() + 1).padStart(2, "0");
            const day = String(date.getUTCDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
        };
        // 5️⃣ Build final sequences
        const sequences = sequenceData.map((seq, index) => {
            const seqLegs = allLegs.filter(l => l.SeqNo === seq.SeqNo && dateKey(l.EffDate) === dateKey(seq.EffDate));
            // ---- Handle Calendar_40Day ----
            const effDate = new Date(seq.EffDate);
            const calendar = seq.Calendar_40Day || "";
            // Identify all flight days (where Calendar_40Day has '1')
            const flightDays = [];
            for (let i = 0; i < calendar.length; i++) {
                if (calendar[i] == "1") {
                    flightDays.push(i + 1); // position is 1-based
                }
            }
            // ✅ Correctly group legs by day using EOD flag
            const dayWiseLegs = [];
            let currentDayLegs = [];
            let dayCounter = 1;
            seqLegs.forEach((leg, idx) => {
                currentDayLegs.push({
                    seqNo: leg.SeqNo,
                    seqLegNo: leg.SeqLegNo,
                    departure: leg.DeptStn,
                    arrival: leg.ArrvStn,
                    flightNo: leg.FitNo,
                    dptTime: toHHmm(leg.DptTime),
                    arvTime: toHHmm(leg.ArvTime),
                    flyingHours: formatMinutes(leg.LegTotalFlying),
                    legPc: leg.LegPC,
                    layover: leg.Layover ? formatMinutes(leg.Layover) : null,
                    eod: leg.EOD
                });
                // 👉 Split when EOD = 1
                if (leg.EOD == 1) {
                    dayWiseLegs.push({
                        day: dayCounter,
                        legs: currentDayLegs
                    });
                    currentDayLegs = [];
                    dayCounter++;
                }
            });
            // 👉 Add any remaining legs (in case last leg doesn't have EOD = 1)
            if (currentDayLegs.length > 0) {
                dayWiseLegs.push({
                    day: dayCounter,
                    legs: currentDayLegs
                });
            }
            // ---- Calculate pay info ----
            let totalPayMinutes = 0;
            let totalCreditMinutes = 0;
            seqLegs.forEach(l => {
                totalPayMinutes += (l.LegTotalFlying ?? 0) + (l.LegPC ?? 0);
                totalCreditMinutes += (l.LegTotalFlying ?? 0);
            });
            const lastArrvStn = seqLegs.length > 0 ? seqLegs[seqLegs.length - 1].ArrvStn : null;
            const perDiemRate = perDiemRates[seq.SeqCategory] ?? 0;
            const tafMinutes = seq.TAFB ?? 0;
            const tafPerDiem = (tafMinutes / 60) * perDiemRate;
            const flightPay = (totalPayMinutes / 60) * baseRate;
            const creditPay = (totalCreditMinutes / 60) * baseRate;
            const premiumPay = ((seq.SeqPremTime ?? 0) / 60) * baseRate;
            const totalEarnings = flightPay + tafPerDiem + premiumPay;
            // ✅ Final structured sequence
            return {
                seqNo: seq.SeqNo,
                crewBase: seq.CrewBase,
                category: seq.SeqCategory,
                effDate: seq.EffDate,
                thruDate: seq.ThruDate,
                totalLegs: seq.NBR_Legs,
                totalDays: seq.NBR_Days,
                totalDuty: seq.NBR_Duty,
                seqCrewPos: seq.SeqCrewPos,
                slots: normalizeSeqCrewPos(seq.SeqCrewPos),
                lastArrvStn,
                payHours: formatMinutes(totalPayMinutes),
                creditHours: formatMinutes(totalCreditMinutes),
                tafb: formatMinutes(seq.TAFB),
                seqPremiumTime: toHHmm(seq.SeqPremTime),
                // 🆕 Flight day details
                totalFlyingDays: flightDays.length,
                flightDays,
                dayWiseLegs,
                earnings: {
                    yearsOfService,
                    baseRate,
                    perDiemRate,
                    tafMinutes,
                    tafPerDiem: tafPerDiem.toFixed(2),
                    flightPay: flightPay.toFixed(2),
                    creditPay: creditPay.toFixed(2),
                    premiumPay: premiumPay.toFixed(2),
                    totalEarnings: totalEarnings.toFixed(2)
                },
                // All legs (detailed)
                legs: seqLegs.map((leg) => ({
                    seqNo: leg.SeqNo,
                    seqLegNo: leg.SeqLegNo,
                    departure: leg.DeptStn,
                    arrival: leg.ArrvStn,
                    flightNo: leg.FitNo,
                    dptTime: toHHmm(leg.DptTime),
                    arvTime: toHHmm(leg.ArvTime),
                    flyingHours: formatMinutes(leg.LegTotalFlying),
                    legPc: leg.LegPC,
                    layover: leg.Layover ? formatMinutes(leg.Layover) : null,
                    eod: leg.EOD
                }))
            };
        });
        // 6️⃣ Separate completed vs upcoming
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const completedSequences = sequences.filter(seq => new Date(seq.effDate) < today);
        const upcomingSequences = sequences.filter(seq => new Date(seq.effDate) >= today);
        const effDates = sequences.map(seq => dateKey(seq.effDate));
        // ✅ Final response
        return res.status(200).json({
            message: "Sequence(s) & legs fetched successfully",
            sequences,
            effDates,
            completedSequences,
            upcomingSequences
        });
    }
    catch (error) {
        console.error("Error in sequenceWithLegs:", error);
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({
            message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};
exports.sequenceWithLegs = sequenceWithLegs;
const sequence = async (req, res) => {
    try {
        // const seqNo = Number(req.query.seqNo);
        const bidMonth = req.query.bidMonth;
        const userId = req.user.id;
        const crewId = req.user.crewId;
        // 🔹 Parse current bidMonth like "Sep2025"
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthAbbr = bidMonth.substring(0, 3);
        const year = parseInt(bidMonth.substring(3));
        const monthIndex = monthNames.indexOf(monthAbbr);
        let prevMonthIndex = monthIndex - 1;
        let prevYear = year;
        if (prevMonthIndex < 0) {
            prevMonthIndex = 11;
            prevYear -= 1;
        }
        const prevBidMonth = `${monthNames[prevMonthIndex]}${prevYear}`;
        // 1) Get UserSequence
        const pool = await (0, db_1.getPool)();
        // 1) Get sequences
        // const userSeqResult = await pool.request()
        //     .input("userId", sql.UniqueIdentifier, userId)
        //     .input("bidMonth", sql.NVarChar, bidMonth)
        //     .query(`
        //             SELECT * 
        //             FROM dbo.UserSequence
        //             WHERE UserID = @userId
        //             AND BidMonth = @bidMonth
        //         `);
        const userSeqResult = await pool.request()
            .input("userId", db_1.sql.UniqueIdentifier, userId)
            .input("bidMonth", db_1.sql.NVarChar, bidMonth)
            .input("prevBidMonth", db_1.sql.NVarChar, prevBidMonth)
            .query(`
        SELECT * 
        FROM dbo.UserSequence
        WHERE UserID = @userId
        AND (BidMonth = @bidMonth OR BidMonth = @prevBidMonth)
    `);
        const userSequences = userSeqResult.recordset;
        // return res.json({prevBidMonth: prevBidMonth, userSequence: userSequences})
        if (!userSequences || userSequences.length === 0) {
            return res.status(404).json({ message: "No sequence found for this user" });
        }
        // 👇 separate current vs previous month sequences
        const currentMonthSeqs = userSequences.filter(s => s.BidMonth === bidMonth);
        const prevMonthSeqs = userSequences.filter(s => s.BidMonth === prevBidMonth);
        // return res.json({prevMonthSeqs:prevMonthSeqs})
        // const sequences: any[] = [];
        // // 2) Process each sequence
        // for (const seq of currentMonthSeqs) {
        //     const legsResult = await pool.request()
        //         .input("userSequenceId", sql.UniqueIdentifier, seq.UserSequenceID)
        //         .query(`
        //                 SELECT *
        //                 FROM dbo.UserLeg
        //                 WHERE UserSequenceID = @userSequenceId
        //             `);
        //     const seqLegs = legsResult.recordset || [];
        //     // Totals
        //     let totalPayMinutes = 0;
        //     let totalCreditMinutes = 0;
        //     seqLegs.forEach(l => {
        //         totalPayMinutes += (l.LegTotalFlying ?? 0) + (l.LegPC ?? 0);
        //         totalCreditMinutes += (l.LegTotalFlying ?? 0);
        //     });
        //     const lastArrvStn = seqLegs.length > 0 ? seqLegs[seqLegs.length - 1].ArrvStn : null;
        //     // const yearsOfService = 1; // Replace with logic
        //     const service = crewId ? await getCrewPayDetails(crewId) : null;
        //     const yearsOfService = service?.basePay?.YearsOfService ?? 1;
        //     const basePayMap: Record<number, number> = {
        //         1: 35.82, 2: 37.97, 3: 40.40, 4: 43.03, 5: 47.39,
        //         6: 53.67, 7: 59.21, 8: 61.11, 9: 62.80, 10: 65.15,
        //         11: 66.94, 12: 70.12, 13: 82.24
        //     };
        //     const baseRate = basePayMap[yearsOfService] ?? 0;
        //     const perDiemRates: Record<string, number> = { DOM: 2.5, INT: 3.75 };
        //     const perDiemRate = perDiemRates[seq.SeqCategory] ?? 0;
        //     const tafMinutes = seq.TAFB ?? 0;
        //     const tafPerDiem = (tafMinutes / 60) * perDiemRate;
        //     const flightPay = (totalPayMinutes / 60) * baseRate;
        //     const creditPay = (totalCreditMinutes / 60) * baseRate;
        //     const premiumPay = ((seq.SeqPremTime ?? 0) / 60) * baseRate;
        //     const totalSequenceEarnings = flightPay + tafPerDiem + premiumPay;
        //     sequences.push({
        //         ...seq,
        //         lastArrvStn,
        //         slots: normalizeSeqCrewPos(seq.SeqCrewPos),
        //         payHours: formatMinutes(totalPayMinutes),
        //         creditHours: formatMinutes(totalCreditMinutes),
        //         tafb: formatMinutes(seq.TAFB),
        //         seqPremiumTime: toHHmm(seq.SeqPremTime),
        //         earnings: {
        //             yearsOfService,
        //             baseRate,
        //             perDiemRate,
        //             tafMinutes,
        //             tafPerDiem: tafPerDiem.toFixed(2),
        //             flightPay: flightPay.toFixed(2),
        //             creditPay: creditPay.toFixed(2),
        //             premiumPay: premiumPay.toFixed(2),
        //             totalSequenceEarnings: totalSequenceEarnings.toFixed(2)
        //         },
        //         legs: seqLegs.map((leg: any) => ({
        //             seqNo: leg.SeqNo,
        //             seqLegNo: leg.SeqLegNo,
        //             departure: leg.DeptStn,
        //             arrival: leg.ArrvStn,
        //             flightNo: leg.FitNo,
        //             dptTime: toHHmm(leg.DptTime),
        //             arvTime: toHHmm(leg.ArvTime),
        //             flyingHours: formatMinutes(leg.LegTotalFlying),
        //             legPc: leg.LegPC,
        //             layover: leg.LayoverTime ? formatMinutes(leg.LayoverTime) : null,
        //             eod: leg.EOD
        //         }))
        //     });
        // }
        // new
        const sequences = [];
        for (const seq of currentMonthSeqs) {
            const legsResult = await pool.request()
                .input("userSequenceId", db_1.sql.UniqueIdentifier, seq.UserSequenceID)
                .query(`
            SELECT *
            FROM dbo.UserLeg
            WHERE UserSequenceID = @userSequenceId
        `);
            const seqLegs = legsResult.recordset || [];
            // ---- Handle Calendar_40Day ----
            const effDate = new Date(seq.EffDate);
            const calendar = seq.Calendar_40Day || "";
            // Identify all flight days (where Calendar_40Day has '1')
            const flightDays = [];
            for (let i = 0; i < calendar.length; i++) {
                if (calendar[i] === "1")
                    flightDays.push(i + 1);
            }
            // ✅ Step 1: sort legs properly by SeqLegNo
            const sortedLegs = [...seqLegs].sort((a, b) => a.SeqLegNo - b.SeqLegNo);
            // ✅ Step 2: now group them day-wise by EOD
            const dayWiseLegs = [];
            let currentDayLegs = [];
            let dayCounter = 1;
            sortedLegs.forEach((leg, index) => {
                currentDayLegs.push({
                    seqNo: leg.SeqNo,
                    seqLegNo: leg.SeqLegNo,
                    departure: leg.DeptStn,
                    arrival: leg.ArrvStn,
                    flightNo: leg.FitNo,
                    fitLegNo: leg.FitLegNo,
                    dptTime: toHHmm(leg.DptTime),
                    arvTime: toHHmm(leg.ArvTime),
                    dptZone: leg.DptZone,
                    arvZone: leg.ArvZone,
                    flyingHours: formatMinutes(leg.LegTotalFlying || 0),
                    legPc: leg.LegPC,
                    layover: leg.LayoverTime ? formatMinutes(leg.LayoverTime) : null,
                    eod: leg.EOD
                });
                // 👉 If this leg ends the day
                if (leg.EOD == 1) {
                    dayWiseLegs.push({
                        day: dayCounter,
                        legs: currentDayLegs
                    });
                    currentDayLegs = [];
                    dayCounter++;
                }
                // 👉 Handle last leg (no EOD=1)
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
            // ---- Totals ----
            let totalPayMinutes = 0;
            let totalCreditMinutes = 0;
            seqLegs.forEach(l => {
                totalPayMinutes += (l.LegTotalFlying ?? 0) + (l.LegPC ?? 0);
                totalCreditMinutes += (l.LegTotalFlying ?? 0);
            });
            const lastArrvStn = seqLegs.length > 0 ? seqLegs[seqLegs.length - 1].ArrvStn : null;
            const service = crewId ? await (0, userServiceNew_1.getCrewPayDetails)(crewId) : null;
            const yearsOfService = service?.basePay?.YearsOfService ?? 1;
            const basePayMap = {
                1: 35.82, 2: 37.97, 3: 40.40, 4: 43.03, 5: 47.39,
                6: 53.67, 7: 59.21, 8: 61.11, 9: 62.80, 10: 65.15,
                11: 66.94, 12: 70.12, 13: 82.24
            };
            const baseRate = basePayMap[yearsOfService] ?? 0;
            const perDiemRates = { DOM: 2.5, INT: 3.75 };
            const perDiemRate = perDiemRates[seq.SeqCategory] ?? 0;
            const tafMinutes = seq.TAFB ?? 0;
            const tafPerDiem = (tafMinutes / 60) * perDiemRate;
            const flightPay = (totalPayMinutes / 60) * baseRate;
            const creditPay = (totalCreditMinutes / 60) * baseRate;
            const premiumPay = ((seq.SeqPremTime ?? 0) / 60) * baseRate;
            const totalSequenceEarnings = flightPay + tafPerDiem + premiumPay;
            sequences.push({
                ...seq,
                lastArrvStn,
                slots: normalizeSeqCrewPos(seq.SeqCrewPos),
                payHours: formatMinutes(totalPayMinutes),
                creditHours: formatMinutes(totalCreditMinutes),
                tafb: formatMinutes(seq.TAFB),
                seqPremiumTime: toHHmm(seq.SeqPremTime),
                // ✅ Day/flight info added
                totalFlyingDays: flightDays.length,
                flightDays,
                dayWiseLegs,
                earnings: {
                    yearsOfService,
                    baseRate,
                    perDiemRate,
                    tafMinutes,
                    tafPerDiem: tafPerDiem.toFixed(2),
                    flightPay: flightPay.toFixed(2),
                    creditPay: creditPay.toFixed(2),
                    premiumPay: premiumPay.toFixed(2),
                    totalSequenceEarnings: totalSequenceEarnings.toFixed(2)
                },
                legs: seqLegs.map((leg) => ({
                    seqNo: leg.SeqNo,
                    seqLegNo: leg.SeqLegNo,
                    departure: leg.DeptStn,
                    arrival: leg.ArrvStn,
                    flightNo: leg.FitNo,
                    dptTime: toHHmm(leg.DptTime),
                    arvTime: toHHmm(leg.ArvTime),
                    flyingHours: formatMinutes(leg.LegTotalFlying),
                    legPc: leg.LegPC,
                    layover: leg.LayoverTime ? formatMinutes(leg.LayoverTime) : null,
                    eod: leg.EOD
                }))
            });
        }
        const prevSequences = [];
        for (const seq of currentMonthSeqs) {
            const legsResult = await pool.request()
                .input("userSequenceId", db_1.sql.UniqueIdentifier, seq.UserSequenceID)
                .query(`
                        SELECT *
                        FROM dbo.UserLeg
                        WHERE UserSequenceID = @userSequenceId
                    `);
            const seqLegs = legsResult.recordset || [];
            // Totals
            let totalPayMinutes = 0;
            let totalCreditMinutes = 0;
            seqLegs.forEach(l => {
                totalPayMinutes += (l.LegTotalFlying ?? 0) + (l.LegPC ?? 0);
                totalCreditMinutes += (l.LegTotalFlying ?? 0);
            });
            const lastArrvStn = seqLegs.length > 0 ? seqLegs[seqLegs.length - 1].ArrvStn : null;
            const service = crewId ? await (0, userServiceNew_1.getCrewPayDetails)(crewId) : null;
            const yearsOfService = service?.basePay?.YearsOfService ?? 1;
            // return res.json({yearsOfService});
            // const yearsOfService = 1; // Replace with logic
            const basePayMap = {
                1: 35.82, 2: 37.97, 3: 40.40, 4: 43.03, 5: 47.39,
                6: 53.67, 7: 59.21, 8: 61.11, 9: 62.80, 10: 65.15,
                11: 66.94, 12: 70.12, 13: 82.24
            };
            const baseRate = basePayMap[yearsOfService] ?? 0;
            const perDiemRates = { DOM: 2.5, INT: 3.75 };
            const perDiemRate = perDiemRates[seq.SeqCategory] ?? 0;
            const tafMinutes = seq.TAFB ?? 0;
            const tafPerDiem = (tafMinutes / 60) * perDiemRate;
            const flightPay = (totalPayMinutes / 60) * baseRate;
            const creditPay = (totalCreditMinutes / 60) * baseRate;
            const premiumPay = ((seq.SeqPremTime ?? 0) / 60) * baseRate;
            const totalSequenceEarnings = flightPay + tafPerDiem + premiumPay;
            prevSequences.push({
                ...seq,
                lastArrvStn,
                slots: normalizeSeqCrewPos(seq.SeqCrewPos),
                payHours: formatMinutes(totalPayMinutes),
                creditHours: formatMinutes(totalCreditMinutes),
                tafb: formatMinutes(seq.TAFB),
                seqPremiumTime: toHHmm(seq.SeqPremTime),
                earnings: {
                    yearsOfService,
                    baseRate,
                    perDiemRate,
                    tafMinutes,
                    tafPerDiem: tafPerDiem.toFixed(2),
                    flightPay: flightPay.toFixed(2),
                    creditPay: creditPay.toFixed(2),
                    premiumPay: premiumPay.toFixed(2),
                    totalSequenceEarnings: totalSequenceEarnings.toFixed(2)
                },
                legs: seqLegs.map((leg) => ({
                    seqNo: leg.SeqNo,
                    seqLegNo: leg.SeqLegNo,
                    departure: leg.DeptStn,
                    arrival: leg.ArrvStn,
                    flightNo: leg.FitNo,
                    dptTime: toHHmm(leg.DptTime),
                    arvTime: toHHmm(leg.ArvTime),
                    flyingHours: formatMinutes(leg.LegTotalFlying),
                    legPc: leg.LegPC,
                    layover: leg.LayoverTime ? formatMinutes(leg.LayoverTime) : null,
                    eod: leg.EOD
                }))
            });
        }
        // return res.json({prevBidMonth: currentMonthSeqs});
        // return res.json({prevBidMonth: prevSequences});
        // 3) Now calculate earnings summary
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // new 
        const upcomingSequences = sequences.filter(s => new Date(s.EffDate) >= today);
        const completedSequences = sequences.filter(s => new Date(s.EffDate) < today);
        // ✅ Total = sum of all upcoming sequences
        const totalEarnings = upcomingSequences.reduce((sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0), 0);
        let upcomingEarnings = 0;
        let payHours = '';
        let creditHours = '';
        let tafb = '';
        let seqPremiumTime = '';
        let boardings = 0;
        let completedSequencesTotalEarnings = 0;
        // ✅ Calculate all completed sequences total (always)
        completedSequencesTotalEarnings = completedSequences.reduce((sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0), 0);
        if (upcomingSequences.length > 0) {
            // 🔹 Sum total earnings across all upcoming sequences
            const totalUpcomingEarnings = upcomingSequences.reduce((sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0), 0);
            // 🔹 Convert existing formatted hours ("Xh Ym") back to total minutes
            const parseFormattedMinutes = (formatted) => {
                if (!formatted)
                    return 0;
                const match = formatted.match(/(\d+)h\s*(\d+)m/);
                if (!match)
                    return 0;
                const [, h, m] = match.map(Number);
                return h * 60 + (m || 0);
            };
            // 🔹 Sum all minutes for pay, credit, tafb
            const totalPayMinutes = upcomingSequences.reduce((sum, s) => sum + parseFormattedMinutes(s.payHours), 0);
            const totalCreditMinutes = upcomingSequences.reduce((sum, s) => sum + parseFormattedMinutes(s.creditHours), 0);
            const totalTafbMinutes = upcomingSequences.reduce((sum, s) => sum + parseFormattedMinutes(s.tafb), 0);
            const totlaSeqPremiumTime = upcomingSequences.reduce((sum, s) => sum + parseFormattedMinutes(s.seqPremiumTime), 0);
            // 🔹 Optional: sum total number of legs (boardings)
            const totalBoardings = upcomingSequences.reduce((sum, s) => sum + (s.NBR_Legs ?? 0), 0);
            // 🔹 Format totals back to readable strings
            payHours = formatMinutes(totalPayMinutes);
            creditHours = formatMinutes(totalCreditMinutes);
            tafb = formatMinutes(totalTafbMinutes);
            seqPremiumTime = formatMinutes(totlaSeqPremiumTime);
            boardings = totalBoardings;
            upcomingEarnings = totalUpcomingEarnings.toFixed(2);
        }
        // ✅ Combine past + all upcoming (future + today)
        const earningsSummary = {
            payHours,
            creditHours,
            tafb,
            seqPremiumTime,
            boardings,
            upcoming: upcomingEarnings,
            total: totalEarnings,
            display: `${totalEarnings + completedSequencesTotalEarnings}`
        };
        // const completedSequences = sequences.filter(s => new Date(s.EffDate) < today);
        // ✅ Completed sequences total
        // let completedSequencesTotalEarnings = completedSequences.reduce(
        //     (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings),
        //     0
        // );
        // let upcomingEarnings = 0;
        let completedPayHours = '';
        let completedCreditHours = '';
        let completedTafb = '';
        let completedSeqPremiumTime = '';
        let completedBoardings = 0;
        if (completedSequences.length > 0) {
            const parseFormattedMinutes = (formatted) => {
                if (!formatted)
                    return 0;
                const match = formatted.match(/(\d+)h\s*(\d+)m/);
                if (!match)
                    return 0;
                const [, h, m] = match.map(Number);
                return h * 60 + (m || 0);
            };
            const completedPayHoursTotal = completedSequences.reduce(
            // (sum, s) => sum + parseFloat(s.payHours || 0),
            (sum, s) => sum + parseFormattedMinutes(s.payHours || 0), 0);
            const completedCreditHoursTotal = completedSequences.reduce(
            // (sum, s) => sum + parseFloat(s.creditHours || 0),
            (sum, s) => sum + parseFormattedMinutes(s.creditHours || 0), 0);
            const completedTafbTotal = completedSequences.reduce(
            // (sum, s) => sum + parseFloat(s.tafb || 0),
            (sum, s) => sum + parseFormattedMinutes(s.tafb || 0), 0);
            const completedSeqPremiumTimeTotal = completedSequences.reduce(
            // (sum, s) => sum + parseFloat(s.seqPremiumTime || 0),
            (sum, s) => sum + parseFormattedMinutes(s.seqPremiumTime || 0), 0);
            completedBoardings = completedSequences.reduce((sum, s) => sum + (s.NBR_Legs ?? 0), 0);
            // ✅ format each into hours/minutes using your formatMinutes()
            completedPayHours = formatMinutes(completedPayHoursTotal);
            completedCreditHours = formatMinutes(completedCreditHoursTotal);
            completedTafb = formatMinutes(completedTafbTotal);
            completedSeqPremiumTime = formatMinutes(completedSeqPremiumTimeTotal);
        }
        // ✅ If you want the *last* completed sequence earnings (most recent by EffDate)
        let lastCompletedEarnings = 0;
        if (completedSequences.length > 0) {
            const lastCompletedSeq = completedSequences.sort((a, b) => new Date(b.EffDate).getTime() - new Date(a.EffDate).getTime())[0]; // most recent completed
            lastCompletedEarnings = parseFloat(lastCompletedSeq.earnings.totalSequenceEarnings);
        }
        const completedSequencesEarningsSummary = {
            total: completedSequencesTotalEarnings,
            lastCompleted: lastCompletedEarnings,
            completedPayHours,
            completedCreditHours,
            completedTafb,
            completedSeqPremiumTime,
            completedBoardings
        };
        const prevCompletedSequences = prevSequences.filter(s => new Date(s.EffDate) < today);
        // return res.json({ prevBidMonth:  currentMonthSeqs });
        const prevCompletedSummary = {
            total: prevCompletedSequences.reduce((sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0), 0),
            completedPayHours: prevCompletedSequences.reduce((sum, s) => sum + parseFloat(s.payHours), 0),
            completedCreditHours: prevCompletedSequences.reduce((sum, s) => sum + parseFloat(s.creditHours), 0),
            completedTafb: prevCompletedSequences.reduce((sum, s) => sum + parseFloat(s.tafb), 0),
            completedSeqPremiumTime: prevCompletedSequences.reduce((sum, s) => sum + parseFloat(s.seqPremiumTime), 0),
            completedBoardings: prevCompletedSequences.reduce((sum, s) => sum + parseFloat(s.NBR_Legs), 0),
        };
        return res.status(200).json({
            message: "User Sequence Data with User Legs",
            earningsSummary,
            completedSequencesEarningsSummary,
            prevBidMonth: prevBidMonth,
            prevCompletedSummary,
            completedSequences,
            upcomingSequences
        });
    }
    catch (error) {
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
};
exports.sequence = sequence;
const filterByDate = async (req, res) => {
    try {
        const seqNo = Number(req.query.seqNo);
        const effDate = new Date(req.query.effDate);
        if (!seqNo || isNaN(seqNo)) {
            return res.status(400).json({ message: "seqNo is required and must be numeric" });
        }
        if (!req.query.effDate) {
            return res.status(400).json({ message: "effDate is required" });
        }
        const data = await (0, userServiceNew_1.findByDateAndSeqNo)(seqNo, effDate);
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
            dptTime: toHHmm(leg.DptTime),
            arvTime: toHHmm(leg.ArvTime),
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
    }
    catch (error) {
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({
            message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};
exports.filterByDate = filterByDate;
const applyPosition = async (req, res) => {
    try {
        const { seqNo, position, effDate } = req.body;
        const userId = req.user.id;
        if (!seqNo || !position) {
            return res.status(statusCodes_1.StatusCode.BAD_REQUEST).json({ message: "seqNo and position are required" });
        }
        const updatedSeqCrewPos = await (0, userServiceNew_1.updatePosition)(Number(seqNo), Number(position), effDate);
        if (!updatedSeqCrewPos) {
            return res.status(statusCodes_1.StatusCode.NOT_FOUND).json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        const newUserSequenceId = await (0, userServiceNew_1.addSequenceDataInUserSequence)(userId, updatedSeqCrewPos);
        const newUserLegId = await (0, userServiceNew_1.addLegDataInUserLeg)(seqNo, effDate, newUserSequenceId);
        return res.status(statusCodes_1.StatusCode.OK).json({
            message: "Position Applied Successfully",
            updatedSeqCrewPos
        });
    }
    catch (error) {
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({
            message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};
exports.applyPosition = applyPosition;
const basePay = async (req, res) => {
    try {
        const crewId = req.user.crewId;
        const service = await (0, userServiceNew_1.getCrewPayDetails)(crewId);
        const basePayMap = {
            1: 35.82,
            2: 37.97,
            3: 40.40,
            4: 43.03,
            5: 47.39,
            6: 53.67,
            7: 59.21,
            8: 61.11,
            9: 62.80,
            10: 65.15,
            11: 66.94,
            12: 70.12,
            13: 82.24
        };
        let pay = basePayMap[service.basePay.YearsOfService] ?? 0;
        const understaffingPayRate = 10.50;
        const domesticPayRate = 2.5;
        const internationalPayRate = 3.75;
        const boardingPayRate = await (0, userServiceNew_1.getBoardingPayByYears)(service.basePay.YearsOfService);
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
        };
        const perDiems = {
            domesticRate: domesticPayRate,
            internationalRate: internationalPayRate
        };
        const boardingPay = {
            min40: boardingPayRate?.Boarding40Min,
            min45: boardingPayRate?.Boarding45Min,
            min55: boardingPayRate?.Boarding55Min
        };
        const premiumPay = {
            ipd: ipdRate,
            nips: nipsRate,
            speaker: speakerRate,
            speakerIntNipd: speakerIntNipdRate,
            speakerIpd: speakerIpdRate
        };
        return res.status(200).json({ message: "Base Pay Data", service, regularPayRates, perDiems, boardingPay, premiumPay });
    }
    catch (error) {
        console.error("Error in getProfile:", error);
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
};
exports.basePay = basePay;
const deleteSequence = async (req, res) => {
    try {
        const { userId, seqNo, bidMonth } = req.body;
        if (!userId || !seqNo || !bidMonth) {
            return res
                .status(statusCodes_1.StatusCode.BAD_REQUEST || 400)
                .json({ message: "userId, seqNo, and bidMonth are required." });
        }
        const pool = await (0, db_1.getPool)();
        // Step 1: Fetch the UserSequenceID for validation
        const { recordset: sequenceResult } = await pool
            .request()
            .input("UserID", userId)
            .input("SeqNo", seqNo)
            .input("BidMonth", bidMonth)
            .query(`
        SELECT TOP 1 UserSequenceID 
        FROM UserSequence 
        WHERE UserID = @UserID AND SeqNo = @SeqNo AND BidMonth = @BidMonth
      `);
        if (sequenceResult.length === 0) {
            return res
                .status(statusCodes_1.StatusCode.NOT_FOUND || 404)
                .json({ message: "No sequence found for this user." });
        }
        const userSequenceId = sequenceResult[0].UserSequenceID;
        // Step 2: Begin transaction
        const transaction = pool.transaction();
        await transaction.begin();
        try {
            // Step 3: Delete associated UserLegs (new request)
            await transaction
                .request()
                .input("UserSequenceID", userSequenceId)
                .query(`DELETE FROM UserLeg WHERE UserSequenceID = @UserSequenceID`);
            // Step 4: Delete the UserSequence (new request)
            await transaction
                .request()
                .input("UserSequenceID", userSequenceId)
                .query(`DELETE FROM UserSequence WHERE UserSequenceID = @UserSequenceID`);
            // Step 5: Commit transaction
            await transaction.commit();
            console.log(`✅ Sequence ${userSequenceId} and its legs deleted successfully.`);
            return res.status(statusCodes_1.StatusCode.OK || 200).json({
                message: "Sequence and its associated legs deleted successfully."
            });
        }
        catch (innerError) {
            await transaction.rollback();
            console.error("❌ Transaction rolled back:", innerError);
            return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR || 500).json({
                message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR || "Internal Server Error",
                error: innerError.message
            });
        }
    }
    catch (error) {
        console.error("Error in deleteSequence:", error);
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR || 500).json({
            message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR || "Internal Server Error",
            error: error.message
        });
    }
};
exports.deleteSequence = deleteSequence;
// flight stubs
// === Core function to call FlightAware API ===
// export async function fetchFlightStubs(flightNumber: string): Promise<any[]> {
//     try {
//         const FLIGHTAWARE_BASE_URL = "https://aeroapi.flightaware.com/aeroapi";
//         const API_KEY = process.env.FLIGHTAWARE_API_KEY;
//         const response = await axios.get(`${FLIGHTAWARE_BASE_URL}/flights/${flightNumber}`, {
//             headers: {
//                 "x-apikey": API_KEY,
//                 "Accept": "application/json",
//             },
//         });
//         return response.data.flights || [];
//     } catch (error: any) {
//         console.error("FlightAware API error:", error.response?.data || error.message);
//         return [];
//     }
// }
// // === Save stub into UpdateTracking & update UserLeg ===
// export async function saveFlightStub(seqId: number, userLegId: number, flightNumber: string, stub: any) {
//     // const pool = await sql.connect();
//     // await pool.request()
//     const pool = await getPool();
//     await pool.request()
//         .input("seq_id", sql.Int, seqId)
//         .input("flight_number", sql.NVarChar, flightNumber)
//         .input("update_type_id", sql.Int, 1)
//         .input("update_message", sql.NVarChar, JSON.stringify(stub))
//         .input("timestamp", sql.DateTime, new Date(stub.actual_on || stub.actual_out || new Date()))
//         .input("source_api_id", sql.Int, 1)
//         .query(`
//       INSERT INTO UpdateTracking (seq_id, flight_number, update_type_id, update_message, timestamp, source_api_id)
//       VALUES (@seq_id, @flight_number, @update_type_id, @update_message, @timestamp, @source_api_id)
//     `);
//     // Update leg status if arrived
//     if (stub.status?.toLowerCase().includes("arrived")) {
//         await pool.request()
//             .input("userLegId", sql.Int, userLegId)
//             .input("flightStatus", sql.NVarChar, "Completed")
//             .query(`
//         UPDATE UserLeg
//         SET FlightStatus = @flightStatus
//         WHERE UserLegID = @userLegId
//       `);
//     }
// }
// // === Core sync job ===
// export async function syncFlightStatuses() {
//     const pool = await getPool();
//     const { recordset: activeLegs } = await pool.request().query(`
//     SELECT UL.UserLegID, UL.FitNo AS FlightNumber, UL.UserSequenceID
//     FROM UserLeg UL
//     INNER JOIN UserSequence US ON UL.UserSequenceID = US.UserSequenceID
//     WHERE UL.FlightStatus NOT IN ('Completed', 'Cancelled')
//       AND US.EffDate <= GETUTCDATE()
//       AND US.ThruDate >= GETUTCDATE()
//   `);
//     for (const leg of activeLegs) {
//         const stubs = await fetchFlightStubs(leg.FlightNumber);
//         for (const stub of stubs) {
//             await saveFlightStub(leg.UserSequenceID, leg.UserLegID, leg.FlightNumber, stub);
//         }
//     }
//     // After all legs, update sequences that have all flights completed
//     await pool.request().query(`
//     UPDATE UserSequence
//     SET FlightStatus = 'Completed'
//     WHERE UserSequenceID IN (
//       SELECT US.UserSequenceID
//       FROM UserSequence US
//       WHERE NOT EXISTS (
//         SELECT 1 FROM UserLeg UL
//         WHERE UL.UserSequenceID = US.UserSequenceID
//         AND UL.FlightStatus != 'Completed'
//       )
//     )
//   `);
//     console.log("✅ Flight statuses synced and sequences updated.");
// }
// // === Run cronjob every 30 minutes ===
// cron.schedule("*/55 * * * *", async () => {
//     console.log("🕒 Running FlightAware sync...");
//     await syncFlightStatuses();
// });
// === API endpoint to test manually in Postman ===
// new
const getStubs = async (req, res) => {
    try {
        const { flightNumber, date } = req.params; // e.g., "UAL4", "2025-10-05"
        if (!flightNumber || !date) {
            return res.status(400).json({ success: false, message: "flightNumber and date are required" });
        }
        const FLIGHTAWARE_BASE_URL = "https://aeroapi.flightaware.com/aeroapi";
        const API_KEY = process.env.FLIGHTAWARE_API_KEY;
        const start = `${date}T00:00:00Z`;
        const end = `${date}T23:59:59Z`;
        const response = await axios_1.default.get(`${FLIGHTAWARE_BASE_URL}/flights/${flightNumber}`, {
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
    }
    catch (error) {
        console.error("Error fetching flight stubs:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Failed to fetch flight stubs",
            error: error.response?.data || error.message,
        });
    }
};
exports.getStubs = getStubs;
// helper functions
const formatMinutes = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${m}`;
};
const toHHmm = (time) => {
    const hh = Math.floor(time / 60);
    const mm = time % 60;
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
};
const normalizeSeqCrewPos = (seqCrewPos) => {
    if (!seqCrewPos)
        return [];
    return seqCrewPos.split("").map(ch => ch === "1");
};
// converts departure minutes to boarding minutes (subtracts 30min safely)
const calculateBoardingTime = (dptTime) => {
    let boarding = dptTime - 30;
    if (boarding < 0) {
        boarding = 1440 + boarding; // wrap around if it goes before midnight
    }
    return boarding;
};
