import { Request, Response } from 'express';
import { Messages } from "../constants/responseMessages";
import { StatusCode } from "../constants/statusCodes";
import { resetPasswordSchema } from '../validations/authValidation';
// import { deleteMedia, getUserProfile, uploadMedia } from '../services/authService';
import { deleteFileFromStorage, deleteMedia, updateCrewAvatar, updateCrewReverse, uploadMedia } from '../services/authService';
// import { findUserById, findUserByEmail, findUserAndUpdate } from '../services/userService';
import { findCrewById, findCrewByEmail, getCrewPayDetails, UpdatePassword, findBySequenceNo, findByDateAndSeqNo, getBoardingPayByYears, updatePosition, addSequenceDataInUserSequence, findUserAppliedSequenceNo, addLegDataInUserLeg, getAllCrews, getCrewPayDetail, getUserLanguages } from '../services/userServiceNew';
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

// new
export const getCrewBaseRanking = async (req: Request, res: Response): Promise<any> => {
    try {
        const crewId = (req as any).user.crewId;
        const pool = await getPool();

        // 1) Get logged-in crew
        const crewResult = await pool
            .request()
            .input("crewId", sql.Int, crewId)
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
        const userService = await getCrewPayDetail([crewId]); // pass as array
        const userExperience = userService[0]?.basePay.YearsOfService ?? 0;

        // 2) Get all bases from user’s applied sequences
        const appliedSeqResult = await pool.request()
            .input("userId", sql.UniqueIdentifier, (req as any).user.id)
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

        const flightBases = appliedSeqResult.recordset.map((r: any) => r.Base).filter(Boolean);

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
                .input("base", sql.NVarChar, base)
                .input("crewId", sql.Int, crewId)
                .query(`
                SELECT CrewID
                FROM dbo.Roster
                WHERE Base = @base
                UNION
                SELECT CrewID
                FROM dbo.Roster
                WHERE CrewID = @crewId
            `);

            const crewIds = baseCrewResult.recordset.map((c: any) => c.CrewID);


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

            const services = await getCrewPayDetail(crewIds);

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
    } catch (err: any) {
        console.error("Error in getCrewBaseRanking:", err);
        return res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
};

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
// userController.ts
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

// old
// export const sequenceWithLegs = async (req: Request, res: Response): Promise<any> => {
//     try {
//         const seqNo = Number(req.query.seqNo);
//         const bidMonth = req.query.bidMonth as string;  // 👈 cast to string

//         if (!seqNo || isNaN(seqNo)) {
//             return res.status(400).json({ message: "seqNo is required and must be numeric" });
//         }

//         if (!bidMonth) {
//             return res.status(400).json({ message: "bidMonth is required" });
//         }

//         const sequenceData = await findBySequenceNo(seqNo, bidMonth);
//         // return res.json({ sequenceData: sequenceData });
//         // 2) Fetch crew service info (years of service)
//         const crewId = (req as any).user?.crewId;
//         const service = crewId ? await getCrewPayDetails(crewId) : null;
//         const yearsOfService = service?.basePay?.YearsOfService ?? 1;

//         // Base pay rates
//         const basePayMap: Record<number, number> = {
//             1: 35.82, 2: 37.97, 3: 40.40, 4: 43.03, 5: 47.39,
//             6: 53.67, 7: 59.21, 8: 61.11, 9: 62.80, 10: 65.15,
//             11: 66.94, 12: 70.12, 13: 82.24
//         };
//         const baseRate = basePayMap[yearsOfService] ?? 0;

//         // Per diem rates
//         const perDiemRates: Record<string, number> = {
//             DOM: 2.5,
//             INT: 3.75
//         };

//         // 3) Fetch all legs once
//         const pool = await getPool();
//         const legsResult = await pool.request()
//             .input("seqNo", sql.Int, seqNo)
//             .input("bidMonth", sql.NVarChar, bidMonth)
//             .query(`SELECT * FROM dbo.Leg WHERE SeqNo = @seqNo AND BidMonth = @bidMonth`);
//         const allLegs = legsResult.recordset || [];

//         // Helper for date normalization
//         const dateKey = (d: any) => {
//             if (!d) return "null";
//             const date = new Date(d);
//             const y = date.getUTCFullYear();
//             const m = String(date.getUTCMonth() + 1).padStart(2, "0");
//             const day = String(date.getUTCDate()).padStart(2, "0");
//             return `${y}-${m}-${day}`;
//         };

//         // 4) Build sequences with filtered legs
//         const sequences = sequenceData.map((seq: any) => {
//             // Legs belonging to this sequence AND same EffDate
//             const seqLegs = allLegs.filter(
//                 l => l.SeqNo === seq.SeqNo && dateKey(l.EffDate) === dateKey(seq.EffDate)
//             );

//             // Totals
//             let totalPayMinutes = 0;
//             let totalCreditMinutes = 0;
//             seqLegs.forEach(l => {
//                 totalPayMinutes += (l.LegTotalFlying ?? 0) + (l.LegPC ?? 0);
//                 totalCreditMinutes += (l.LegTotalFlying ?? 0);
//             });

//             // Last arrival
//             const lastArrvStn = seqLegs.length > 0 ? seqLegs[seqLegs.length - 1].ArrvStn : null;

//             // Per diem
//             const perDiemRate = perDiemRates[seq.SeqCategory] ?? 0;
//             const tafMinutes = seq.TAFB ?? 0;
//             const tafPerDiem = (tafMinutes / 60) * perDiemRate;

//             // Earnings
//             const flightPay = (totalPayMinutes / 60) * baseRate;
//             const creditPay = (totalCreditMinutes / 60) * baseRate;
//             const premiumPay = ((seq.SeqPremTime ?? 0) / 60) * baseRate;
//             const totalEarnings = flightPay + tafPerDiem + premiumPay;

//             return {
//                 seqNo: seq.SeqNo,
//                 crewBase: seq.CrewBase,
//                 category: seq.SeqCategory,
//                 effDate: seq.EffDate,
//                 thruDate: seq.ThruDate,
//                 totalLegs: seq.NBR_Legs,
//                 totalDays: seq.NBR_Days,
//                 totalDuty: seq.NBR_Duty,
//                 seqCrewPos: seq.SeqCrewPos,
//                 slots: normalizeSeqCrewPos(seq.SeqCrewPos),
//                 lastArrvStn,
//                 boardings: seq.NBR_Legs,
//                 payHours: formatMinutes(totalPayMinutes),
//                 creditHours: formatMinutes(totalCreditMinutes),
//                 tafb: formatMinutes(seq.TAFB),
//                 seqPremiumTime: toHHmm(seq.SeqPremTime),

//                 earnings: {
//                     yearsOfService,
//                     baseRate,
//                     perDiemRate,
//                     tafMinutes,
//                     tafPerDiem: tafPerDiem.toFixed(2),
//                     flightPay: flightPay.toFixed(2),
//                     creditPay: creditPay.toFixed(2),
//                     premiumPay: premiumPay.toFixed(2),
//                     totalEarnings: totalEarnings.toFixed(2)
//                 },

//                 legs: seqLegs.map((leg: any) => ({
//                     seqNo: leg.SeqNo,
//                     seqLegNo: leg.SeqLegNo,
//                     departure: leg.DeptStn,
//                     arrival: leg.ArrvStn,
//                     flightNo: leg.FitNo,
//                     dptTime: toHHmm(leg.DptTime),
//                     arvTime: toHHmm(leg.ArvTime),
//                     flyingHours: formatMinutes(leg.LegTotalFlying),
//                     legPc: leg.LegPC,
//                     layover: leg.Layover ? formatMinutes(leg.Layover) : null,
//                     eod: leg.EOD
//                 }))
//             };
//         });

//         // 5) Separate completed vs upcoming
//         const today = new Date();
//         today.setHours(0, 0, 0, 0);
//         const completedSequences = sequences.filter(seq => new Date(seq.effDate) < today);
//         const upcomingSequences = sequences.filter(seq => new Date(seq.effDate) >= today);
//         const effDates = sequences.map(seq => dateKey(seq.effDate));

//         return res.status(200).json({
//             message: "Sequence(s) & legs fetched successfully",
//             sequences,
//             effDates,
//             completedSequences,
//             upcomingSequences
//         });

//     } catch (error: any) {
//         console.error("Error in sequenceWithLegs:", error);
//         return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
//             message: Messages.INTERNAL_SERVER_ERROR,
//             error: error.message
//         });
//     }
// };
// new
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

        // 1️⃣ Fetch sequence data
        const sequenceData = await findBySequenceNo(seqNo, bidMonth);

        // 2️⃣ Crew service info
        const crewId = (req as any).user?.crewId;
        const service = crewId ? await getCrewPayDetails(crewId) : null;
        const yearsOfService = service?.basePay?.YearsOfService ?? 1;

        // 3️⃣ Base pay & per diem rates
        const basePayMap: Record<number, number> = {
            1: 35.82, 2: 37.97, 3: 40.40, 4: 43.03, 5: 47.39,
            6: 53.67, 7: 59.21, 8: 61.11, 9: 62.80, 10: 65.15,
            11: 66.94, 12: 70.12, 13: 82.24
        };
        const baseRate = basePayMap[yearsOfService] ?? 0;

        const perDiemRates: Record<string, number> = {
            DOM: 2.5,
            INT: 3.75
        };

        // 4️⃣ Fetch all legs
        const pool = await getPool();
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
        const sequences = sequenceData.map((seq: any, index: number) => {
            const seqLegs = allLegs.filter(
                l => l.SeqNo === seq.SeqNo && dateKey(l.EffDate) === dateKey(seq.EffDate)
            );

            // ---- Handle Calendar_40Day ----
            const effDate = new Date(seq.EffDate);
            const calendar = seq.Calendar_40Day || "";

            // Identify all flight days (where Calendar_40Day has '1')
            const flightDays: number[] = [];
            for (let i = 0; i < calendar.length; i++) {
                if (calendar[i] == "1") {
                    flightDays.push(i + 1); // position is 1-based
                }
            }

            // ✅ Correctly group legs by day using EOD flag
            const dayWiseLegs: any[] = [];
            let currentDayLegs: any[] = [];
            let dayCounter = 1;

            seqLegs.forEach((leg: any, idx: number) => {
                currentDayLegs.push({
                    // legNo: leg.SeqLegNo,
                    // dept: leg.DeptStn,
                    // arrv: leg.ArrvStn,
                    // flightNo: leg.FitNo,    
                    // eod: leg.EOD == 1
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
                legs: seqLegs.map((leg: any) => ({
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

    } catch (error: any) {
        console.error("Error in sequenceWithLegs:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            message: Messages.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};

export const sequence = async (req: Request, res: Response): Promise<any> => {
    try {
        // const seqNo = Number(req.query.seqNo);
        const bidMonth = req.query.bidMonth as string;
        const userId = (req as any).user.id;
        const crewId = (req as any).user.crewId;

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
        const pool = await getPool();

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
            .input("userId", sql.UniqueIdentifier, userId)
            .input("bidMonth", sql.NVarChar, bidMonth)
            .input("prevBidMonth", sql.NVarChar, prevBidMonth)
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

        const sequences: any[] = [];

        // 2) Process each sequence
        for (const seq of currentMonthSeqs) {
            const legsResult = await pool.request()
                .input("userSequenceId", sql.UniqueIdentifier, seq.UserSequenceID)
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

            // const yearsOfService = 1; // Replace with logic

            const service = crewId ? await getCrewPayDetails(crewId) : null;
            const yearsOfService = service?.basePay?.YearsOfService ?? 1;
            const basePayMap: Record<number, number> = {
                1: 35.82, 2: 37.97, 3: 40.40, 4: 43.03, 5: 47.39,
                6: 53.67, 7: 59.21, 8: 61.11, 9: 62.80, 10: 65.15,
                11: 66.94, 12: 70.12, 13: 82.24
            };
            const baseRate = basePayMap[yearsOfService] ?? 0;

            const perDiemRates: Record<string, number> = { DOM: 2.5, INT: 3.75 };
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
                legs: seqLegs.map((leg: any) => ({
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

        const prevSequences: any[] = [];

        for (const seq of currentMonthSeqs) {
            const legsResult = await pool.request()
                .input("userSequenceId", sql.UniqueIdentifier, seq.UserSequenceID)
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

            const service = crewId ? await getCrewPayDetails(crewId) : null;
            const yearsOfService = service?.basePay?.YearsOfService ?? 1;
            // return res.json({yearsOfService});
            // const yearsOfService = 1; // Replace with logic
            const basePayMap: Record<number, number> = {
                1: 35.82, 2: 37.97, 3: 40.40, 4: 43.03, 5: 47.39,
                6: 53.67, 7: 59.21, 8: 61.11, 9: 62.80, 10: 65.15,
                11: 66.94, 12: 70.12, 13: 82.24
            };
            const baseRate = basePayMap[yearsOfService] ?? 0;

            const perDiemRates: Record<string, number> = { DOM: 2.5, INT: 3.75 };
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
                legs: seqLegs.map((leg: any) => ({
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

        // const upcomingSequences = sequences.filter(s => new Date(s.EffDate) >= today);
        // const completedSequences = sequences.filter(s => new Date(s.EffDate) < today);

        // // ✅ Total = sum of all upcoming sequences
        // const totalEarnings = upcomingSequences.reduce(
        //     (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0),
        //     0
        // );

        // // ✅ Upcoming = only sequences starting *today*
        // let upcomingEarnings = 0;
        // let payHours = 0;
        // let creditHours = 0;
        // let tafb = 0;
        // let seqPremiumTime = 0;
        // let boardings = 0;

        // let completedSequencesTotalEarnings = 0;

        // const todaySequences = upcomingSequences.filter(s => {
        //     const eff = new Date(s.EffDate);
        //     eff.setHours(0, 0, 0, 0);
        //     return eff.getTime() === today.getTime();
        // });

        // if (todaySequences.length > 0) {
        //     // if multiple sequences today, sum them
        //     upcomingEarnings = todaySequences.reduce(
        //         (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0),
        //         0
        //     );
        //     completedSequencesTotalEarnings = completedSequences.reduce(
        //         (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings),
        //         0
        //     );

        //     // if you want details, take the first today sequence
        //     const firstTodaySeq = todaySequences[0];
        //     payHours = firstTodaySeq.payHours;
        //     creditHours = firstTodaySeq.creditHours;
        //     tafb = firstTodaySeq.tafb;
        //     seqPremiumTime = firstTodaySeq.seqPremiumTime;
        //     boardings = firstTodaySeq.NBR_Legs;
        // }

        // new 
        const upcomingSequences = sequences.filter(s => new Date(s.EffDate) >= today);
        const completedSequences = sequences.filter(s => new Date(s.EffDate) < today);

        // ✅ Total = sum of all upcoming sequences
        const totalEarnings = upcomingSequences.reduce(
            (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0),
            0
        );

        let upcomingEarnings = 0;
        let payHours = 0;
        let creditHours = 0;
        let tafb = 0;
        let seqPremiumTime = 0;
        let boardings = 0;

        let completedSequencesTotalEarnings = 0;

        // ✅ Calculate all completed sequences total (always)
        completedSequencesTotalEarnings = completedSequences.reduce(
            (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0),
            0
        );

        // ✅ Calculate today’s sequences (optional display)
        const todaySequences = upcomingSequences.filter(s => {
            const eff = new Date(s.EffDate);
            eff.setHours(0, 0, 0, 0);
            return eff.getTime() === today.getTime();
        });

        if (todaySequences.length > 0) {
            // If multiple sequences today, sum them
            upcomingEarnings = todaySequences.reduce(
                (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings || 0),
                0
            );

            // If you want details, take the first today sequence
            const firstTodaySeq = todaySequences[0];
            payHours = firstTodaySeq.payHours;
            creditHours = firstTodaySeq.creditHours;
            tafb = firstTodaySeq.tafb;
            seqPremiumTime = firstTodaySeq.seqPremiumTime;
            boardings = firstTodaySeq.NBR_Legs;
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
        const completedPayHours = completedSequences.reduce(
            (sum, s) => sum + parseFloat(s.payHours),
            0
        )
        const completedCreditHours = completedSequences.reduce(
            (sum, s) => sum + parseFloat(s.creditHours),
            0
        )
        const completedTafb = completedSequences.reduce(
            (sum, s) => sum + parseFloat(s.tafb),
            0
        )
        const completedSeqPremiumTime = completedSequences.reduce(
            (sum, s) => sum + parseFloat(s.seqPremiumTime),
            0
        )
        const completedBoardings = completedSequences.reduce(
            (sum, s) => sum + parseFloat(s.NBR_Legs),
            0
        )

        // ✅ If you want the *last* completed sequence earnings (most recent by EffDate)
        let lastCompletedEarnings = 0;
        if (completedSequences.length > 0) {
            const lastCompletedSeq = completedSequences.sort(
                (a, b) => new Date(b.EffDate).getTime() - new Date(a.EffDate).getTime()
            )[0]; // most recent completed
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
        const effDate = new Date(req.query.effDate as string);

        if (!seqNo || isNaN(seqNo)) {
            return res.status(400).json({ message: "seqNo is required and must be numeric" });
        }
        if (!req.query.effDate) {
            return res.status(400).json({ message: "effDate is required" });
        }

        const data = await findByDateAndSeqNo(seqNo, effDate);

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
    } catch (error: any) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            message: Messages.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};

export const applyPosition = async (req: Request, res: Response): Promise<any> => {
    try {
        const { seqNo, position, effDate } = req.body;
        const userId = (req as any).user.id
        if (!seqNo || !position) {
            return res.status(StatusCode.BAD_REQUEST).json({ message: "seqNo and position are required" });
        }

        const updatedSeqCrewPos = await updatePosition(Number(seqNo), Number(position), effDate);

        if (!updatedSeqCrewPos) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

        const newUserSequenceId = await addSequenceDataInUserSequence(userId, updatedSeqCrewPos);
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
        const basePayMap: Record<number, number> = {
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
                .status(StatusCode.BAD_REQUEST || 400)
                .json({ message: "userId, seqNo, and bidMonth are required." });
        }

        const pool = await getPool();

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
                .status(StatusCode.NOT_FOUND || 404)
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

            return res.status(StatusCode.OK || 200).json({
                message: "Sequence and its associated legs deleted successfully."
            });
        } catch (innerError: any) {
            await transaction.rollback();
            console.error("❌ Transaction rolled back:", innerError);
            return res.status(StatusCode.INTERNAL_SERVER_ERROR || 500).json({
                message: Messages.INTERNAL_SERVER_ERROR || "Internal Server Error",
                error: innerError.message
            });
        }
    } catch (error: any) {
        console.error("Error in deleteSequence:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR || 500).json({
            message: Messages.INTERNAL_SERVER_ERROR || "Internal Server Error",
            error: error.message
        });
    }
};
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
export const getStubs = async (req: Request, res: Response): Promise<any> => {
    try {
        const { flightNumber, date } = req.params; // e.g., "UAL4", "2025-10-05"
        if (!flightNumber || !date) {
            return res.status(400).json({ success: false, message: "flightNumber and date are required" });
        }

        const FLIGHTAWARE_BASE_URL = "https://aeroapi.flightaware.com/aeroapi";
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
    return `${h}h ${m}m`;
}

const toHHmm = (time: number): string => {
    const hh = Math.floor(time / 60);
    const mm = time % 60;
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
};

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
