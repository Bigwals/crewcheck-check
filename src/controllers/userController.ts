import { Request, Response } from 'express';
import { Messages } from "../constants/responseMessages";
import { StatusCode } from "../constants/statusCodes";
import { resetPasswordSchema } from '../validations/authValidation';
// import { deleteMedia, getUserProfile, uploadMedia } from '../services/authService';
import { addLanguages, deleteFileFromStorage, deleteMedia, updateCrewAvatar, updateCrewReverse, uploadMedia } from '../services/authService';
// import { findUserById, findUserByEmail, findUserAndUpdate } from '../services/userService';
import {
    findCrewById, findCrewByEmail, getCrewPayDetails, UpdatePassword, findBySequenceNo, getBoardingPayByYears, updatePosition,
    addSequenceDataInUserSequence, findUserAppliedSequenceNo, addLegDataInUserLeg, getAllCrews, getCrewPayDetail,
    getUserLanguages, getDynamicBaseRate, checkAlreadyApplied, findByBidMonth, findByDateAndSeqNo,
    updateCrewProfile, deleteLanguages
}
    from '../services/userServiceNew';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { Sequence } from '../models/Sequence';
import { UserSequence } from '../models/UserSequence';
import { getPool, sql } from "../config/db";
// import { findUserById } from '../services/userService';
import { any } from 'zod';
import axios from "axios";
require("dotenv").config()
import { config } from 'dotenv';
import cron from "node-cron";
import { totalmem } from 'os';
// import { buildMonthSummary } from "../services/monthService";

export const getProfile = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.id;
        const crewId = (req as any).user.crewId;

        const pool = await getPool();

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
        const crewBase = crew?.Base;

        const baseSeniority = await pool
            .request()
            .input("crewId", sql.Int, crewId)
            .input("crewBase", sql.NVarChar, crewBase)   // ✅ You MUST pass this
            .query(`
            SELECT *
            FROM (
                SELECT 
                    CrewID,
                    Base,
                    ROW_NUMBER() OVER (ORDER BY CrewID) AS PositionNumber
                FROM Roster
                WHERE Base = @crewBase
            ) AS Ranked
            WHERE CrewID = @crewId;
        `);

        // return res.json({ baseSeniority })
        if (baseSeniority.recordset.length == 0) {
            return res.status(404).json({ message: "Crew not found" });
        }

        // ✅ Extract the position
        const position = baseSeniority.recordset[0].PositionNumber;

        const service = await getCrewPayDetails(crewId);
        const languages = await getUserLanguages(userId);
        if (service) return res.status(200).json({ message: Messages.USER_PROFILE, crew, baseSeniority: position, languages, service });
        // const crewBases = await getCrewBaseRanking()
        return res.status(200).json({ message: Messages.USER_PROFILE, crew, languages });
    } catch (error: any) {
        console.error("Error in getProfile:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
};

// new 1
export const getCrewBaseRanking = async (req: Request, res: Response): Promise<any> => {
    try {
        const crewId = (req as any).user.crewId;
        const pool = await getPool();

        const crew = await findCrewById(crewId);
        if (!crew) {
            return res.status(404).json({ message: "Crew not found" });
        }

        const result = await pool
            .request()
            .input("mySeniority", sql.Int, crew.Seniority)
            .input("currentBase", sql.NVarChar, crew.Base)
            .query(`
                WITH BaseSizes AS (
                    SELECT 
                        Base,
                        COUNT(*) AS BaseSize
                    FROM Roster
                    GROUP BY Base
                ),
                ProjectedRanks AS (
                    SELECT
                        b.Base,
                        COUNT(CASE WHEN r.Seniority < @mySeniority THEN 1 END) + 1 AS ProjectedRank
                    FROM (SELECT DISTINCT Base FROM Roster) b
                    LEFT JOIN Roster r
                        ON r.Base = b.Base
                    GROUP BY b.Base
                ),
                CurrentBaseStats AS (
                    SELECT
                        COUNT(CASE WHEN Seniority < @mySeniority THEN 1 END) + 1 AS CurrentBaseRank,
                        COUNT(*) AS CurrentBaseSize
                    FROM Roster
                    WHERE Base = @currentBase
                )
                SELECT
                    p.Base AS iata_code,
                    a.name AS airportName,
                    a.IsInternational,
                    s.BaseSize,
                    p.ProjectedRank,
                    c.CurrentBaseRank,
                    c.CurrentBaseSize
                FROM ProjectedRanks p
                JOIN BaseSizes s ON s.Base = p.Base
                LEFT JOIN Airports a ON a.iata_code = p.Base
                CROSS JOIN CurrentBaseStats c
                ORDER BY p.Base;
            `);

        // ✅ FIXED: use iata_code instead of Base
        const currentBaseRow = result.recordset.find(
            r => r.iata_code === crew.Base
        );

        if (!currentBaseRow) {
            return res.status(404).json({ message: "Current base stats not found" });
        }

        const currentBaseRank = currentBaseRow.CurrentBaseRank;
        const currentBaseSize = currentBaseRow.CurrentBaseSize;
        const currentPercentile = +(
            (currentBaseRank / currentBaseSize) * 100
        ).toFixed(2);

        const projections = result.recordset.map(row => ({
            baseCode: row.iata_code,
            airportName: row.airportName,
            isInternational: row.IsInternational,
            projectedRank: row.ProjectedRank,
            baseSize: row.BaseSize,
            projectedPercentile: +(
                (row.ProjectedRank / row.BaseSize) * 100
            ).toFixed(2),
            direction: row.ProjectedRank < currentBaseRank ? "up" : "down",
            isCurrentBase: row.iata_code === crew.Base
        }));

        return res.status(200).json({
            aaId: crew.CrewID,
            firstName: crew.FirstName,
            lastName: crew.LastName,
            yearsOfService: crew.YearsOfService,
            currentBase: crew.Base,
            currentBaseRank,
            currentBaseSize,
            currentPercentile,
            projections
        });

    } catch (err: any) {
        console.error("Error in getCrewBaseProjections:", err);
        return res.status(500).json({
            message: "Internal Server Error",
            error: err.message
        });
    };
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

export const uploadAvatar = async (req: Request, res: Response): Promise<any> => {
    try {
        const crewId = (req as any).user.crewId;
        const { url } = req.body;
        // const file = req.file;

        // if (!file) {
        //     return res.status(400).json({ message: 'No file uploaded' });
        // }

        // const MAX_SIZE = 2 * 1024 * 1024; // 2MB
        // if (file.size > MAX_SIZE) {
        //     return res.status(400).json({ message: 'File is large. Max allowed size is 2MB.' });
        // }

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
        const updatedCrew = await updateCrewAvatar(crewId, url);

        return res.status(StatusCode.OK).json({
            message: Messages.AVATAR_UPLOADED,
            user: updatedCrew
        });
    } catch (error: any) {
        console.error("Upload Avatar Error:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};

export const updateProfile = async (req: Request, res: Response): Promise<any> => {
    try {
        const crewId = (req as any).user.crewId;
        const UserID = (req as any).user.id;

        const { base, occ_date, aa_seniority, purser, speaker, languages } = req.body;

        const crew = await findCrewById(crewId);
        if (!crew) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

        // ✅ Update profile first
        const updatedCrew = await updateCrewProfile(
            crewId,
            base,
            occ_date,
            aa_seniority,
            purser,
            speaker
        );

        console.log("Languages from request:", languages);

        // ✅ Proper language handling
        if (Array.isArray(languages)) {
            // Step 1: Delete old
            await deleteLanguages(UserID);

            // Step 2: Insert new (only if any)
            if (languages.length > 0) {
                await addLanguages(UserID, languages);
            }
        }

        return res.status(StatusCode.OK).json({
            message: Messages.PROFILE_UPDATED,
            user: updatedCrew
        });

    } catch (error: any) {
        console.error("Update Profile Error:", error);
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

        console.time("SQL_TIME");
        const sequenceData = await findBySequenceNo(seqNo, bidMonth);
        if (!sequenceData.length) {
            return res.status(404).json({ message: "No sequence found for the given SeqNo and BidMonth." });
        }

        const pool = await getPool();

        // ---------- helpers ----------
        const toDecimalHours = (value: any): number => {
            if (value === null || value === undefined || value === "") return 0;
            if (typeof value === "number") return value;
            if (typeof value === "string") {
                // "HH:MM"
                if (value.includes(":")) {
                    const [hhRaw, mmRaw] = value.split(":");
                    const hh = Number(hhRaw) || 0;
                    const mm = Number(mmRaw) || 0;
                    return hh + mm / 60;
                }
                // decimal string
                if (value.includes(".")) return parseFloat(value) || 0;
                // integer string: treat as hours
                const asNum = parseFloat(value);
                if (!isNaN(asNum)) return asNum;
            }
            return 0;
        };

        // ---------- fetch per-diem row (effective) ----------
        const now = new Date();
        let effectiveYear = now.getUTCFullYear();
        const oct1ThisYearUTC = new Date(Date.UTC(effectiveYear, 9, 1));
        if (now < oct1ThisYearUTC) effectiveYear -= 1;
        const perDiemEffectiveDateUTC = new Date(Date.UTC(effectiveYear, 9, 1));

        const perDiemResult = await pool.request()
            .input("perDiemDate", sql.Date, perDiemEffectiveDateUTC)
            .query(`
                SELECT TOP 1 effective_date, dom, int
                FROM PerDiem
                WHERE effective_date <= @perDiemDate
                ORDER BY effective_date DESC
            `);
        const perDiemRow = perDiemResult.recordset?.[0] ?? null;
        const perDiem_dom = perDiemRow ? parseFloat(perDiemRow.dom || 0) : 0;
        const perDiem_int = perDiemRow ? parseFloat(perDiemRow.int || 0) : 0;

        // ---------- fetch airports once ----------
        const airportResult = await pool.request().query(`
            SELECT IATA_Code, IsInternational
            FROM Airports
        `);
        const airportRows = airportResult.recordset || [];

        // return res.json({ airportRows })
        const airportIntl: Record<string, boolean> = {};
        airportRows.forEach(a => {
            if (a && a.IATA_Code) airportIntl[a.IATA_Code.toUpperCase()] = a.IsInternational == 1;
        });

        // ---------- fetch all legs ----------
        const legsResult = await pool.request()
            .input("seqNo", sql.Int, seqNo)
            .input("bidMonth", sql.NVarChar, bidMonth)
            .query(`SELECT * FROM dbo.Leg WHERE SeqNo = @seqNo AND BidMonth = @bidMonth`);
        const allLegs = legsResult.recordset || [];

        // ---------- crew/service/base rate ----------
        const crewId = (req as any).user?.crewId;
        const service = crewId ? await getCrewPayDetails(crewId) : null;
        const yearsOfService = service?.basePay?.YearsOfService ?? 1;
        const baseRate = await getDynamicBaseRate(yearsOfService);

        // ---------- build sequences ----------
        const leg_equip_types: any[] = [];
        const sequences: any[] = [];
        // const effdates: any[] = [];

        for (const seq of sequenceData) {
            const UniqueSeqNo = seq.UniqueSeqNo;

            const frequency = await pool.request()
                .input("UniqueSeqNo", sql.VarChar, UniqueSeqNo)
                .query(`
                    SELECT * FROM Frequency
                    WHERE UniqueSeqNo = @UniqueSeqNo
                `);
            const effDates = frequency.recordset || [];

            // effdates.push()

            const seqLegs = allLegs.filter(
                (l) => l.SeqNo == seq.SeqNo && l.BidMonth === seq.BidMonth
            );

            // ---- calendar/flightDays and dayWiseLegs (unchanged) ----
            const calendar = seq.Calendar_40Day || "";
            const flightDays: number[] = [];
            for (let i = 0; i < calendar.length; i++) {
                if (calendar[i] == "1") flightDays.push(i + 1);
            }

            const EXTRA_LIMIT_MINUTES = 150; // 2 hours 30 minutes
            let extraAmount = 0;
            let layOverHours = 0;
            const dayWiseLegs: any[] = [];
            let currentDayLegs: any[] = [];
            let dayCounter = 1;
            seqLegs.forEach((leg: any, index: number) => {
                currentDayLegs.push({
                    seqNo: leg.SeqNo,
                    seqLegNo: leg.SeqLegNo,
                    departure: leg.DeptStn,
                    arrival: leg.ArrvStn,
                    flightNo: leg.FitNo,
                    dptTime: leg.CvtDptTime,
                    arvTime: leg.CvtArvTime,
                    flyingHours: leg.CvtSeqFlyTime ?? leg.CvtLegTotalFlying,
                    legPc: leg.LegPC,
                    layover: leg.CvtLayover ? leg.CvtLayover : null,
                    eod: leg.EOD,
                });

                /* 👉 ADDITION STARTS (NO CHANGE ABOVE) */

                const nextLeg = seqLegs[index + 1];

                if (
                    nextLeg &&
                    leg.CvtArvTime &&
                    nextLeg.CvtDptTime &&
                    leg.EOD == 0
                ) {
                    const [ah, am, as = 0] = leg.CvtArvTime.split(":").map(Number);
                    const [dh, dm, ds = 0] = nextLeg.CvtDptTime.split(":").map(Number);

                    const arrSeconds = ah * 3600 + am * 60 + as;
                    const depSeconds = dh * 3600 + dm * 60 + ds;

                    let diffSeconds = depSeconds - arrSeconds;

                    // overnight handling
                    if (diffSeconds < 0) {
                        diffSeconds += 24 * 3600;
                    }

                    const extraLimitSeconds = EXTRA_LIMIT_MINUTES * 60;

                    if (diffSeconds > extraLimitSeconds) {
                        let extraSeconds = diffSeconds - extraLimitSeconds;

                        // SIT RIG rule: half pay
                        extraSeconds = Math.floor(extraSeconds / 2);

                        const extraHours = Math.floor(extraSeconds / 3600);
                        const extraMins = Math.floor((extraSeconds % 3600) / 60);
                        const extraSecs = extraSeconds % 60;

                        const totalExtraHours =
                            extraHours +
                            extraMins / 60 +
                            extraSecs / 3600;

                        layOverHours += totalExtraHours;
                        extraAmount += totalExtraHours * baseRate;

                        console.log(
                            `Extra time between leg ${leg.SeqLegNo} → ${nextLeg.SeqLegNo}: ` +
                            `${extraHours}h ${extraMins}m ${extraSecs}s | Pay: ${extraAmount.toFixed(2)}`
                        );
                    }
                }

                /* 👉 ADDITION ENDS */

                if (leg.EOD == 1) {
                    dayWiseLegs.push({ day: dayCounter, legs: currentDayLegs });
                    currentDayLegs = [];
                    dayCounter++;
                }

                leg_equip_types.push({
                    leg_equip_type: leg.LegEqupType,
                    dep_stn: leg.DeptStn,
                    arr_stn: leg.ArrvStn
                });

            });
            if (currentDayLegs.length > 0) dayWiseLegs.push({ day: dayCounter, legs: currentDayLegs });
            console.log("Leg Equip Type:", leg_equip_types);

            // ---- core hours ----
            const cvtSeqPC = toDecimalHours(seq.CvtSeqPC);
            const cvtSeqFlyTime = toDecimalHours(seq.CvtSeqFlyTime);
            const cvtTAFB = toDecimalHours(seq.CvtTAFB);
            const cvtSeqPremTime = toDecimalHours(seq.CvtSeqPremTime);

            console.log("cvtSeqPC===>>>", cvtSeqPC);
            console.log("cvtSeqPC===>>>", cvtSeqFlyTime);
            console.log("cvtSeqPC===>>>", cvtTAFB);
            console.log("cvtSeqPC===>>>", cvtSeqPremTime);

            const deadheadResult = await pool.request()
                .input("seqNo", sql.Int, seq.SeqNo)
                .query(`
                    SELECT SUM(TRY_CAST(CvtDPDeadheadTime AS FLOAT)) AS TotalDPDeadheadHours
                    FROM dbo.Leg
                    WHERE SeqNo = @seqNo
                      AND DPDeadheadTime = 1
                `);
            const cvtDPDeadheadTime = toDecimalHours(deadheadResult.recordset?.[0]?.TotalDPDeadheadHours ?? 0);

            // const payHours = cvtSeqPC + cvtDPDeadheadTime + cvtSeqFlyTime;
            const payHours = 0
            const creditHours = cvtSeqPC + cvtSeqFlyTime;
            const tafbHours = cvtTAFB;
            const premiumHours = cvtSeqPremTime;

            const category = seq.SeqCategory?.toUpperCase() ?? "DOM";
            const premiumTranscon = seq.PremiumTranscon;

            // -------------------------
            // PER DIEM / TAFB PAY LOGIC
            // -------------------------

            let tafbPay = 0;
            let sanityLegTAFBTotal = 0;

            // CASE 1: DOM / IPD / HAW -> simple sequence-level rate
            if (category == "DOM") {
                const perDiemRate = premiumTranscon !== 1 ? perDiem_dom : perDiem_int;
                tafbPay = tafbHours * perDiemRate;
            }

            else if (category == 'IPD' || category == 'HAW') {
                const perDiemRate = perDiem_int;
                tafbPay = tafbHours * perDiemRate;
            }

            // CASE 2: INT -> per-leg detailed calculation
            else if (category == "INT") {
                for (const leg of seqLegs) {
                    console.log("seqLegs Inside the Sequence With Leg", seqLegs)
                    const CvtDPOnDutyTime = toDecimalHours(leg.CvtDPOnDutyTime);

                    console.log("CvtDP")
                    // prefer explicit layover column if available
                    const cvtLayover = toDecimalHours(leg.CvtLayover ?? leg.CvtLayover ?? 0);

                    sanityLegTAFBTotal += (CvtDPOnDutyTime + cvtLayover);

                    const dep = (leg.DeptStn || "").toString().toUpperCase();
                    const arr = (leg.ArrvStn || "").toString().toUpperCase();

                    const isDepINT = airportIntl[dep] == true;
                    const isArrINT = airportIntl[arr] == true;

                    console.log("is Dept Int", isDepINT)
                    console.log("is Arr Int", isArrINT)
                    // Determine flight rate (if either station is INT -> INT rate, else DOM)
                    const legRate = (isDepINT || isArrINT) ? perDiem_int : perDiem_dom;

                    console.log("Leg Rate", legRate)
                    // ---- IMPORTANT: EOD layover handling ----
                    // If EOD === 1 => apply arrival-based rate to cvtLayover.
                    // If EOD !== 1 => include layover in flightPart and pay at flightRate (no special layover pay).
                    let legPay = 0;
                    if (cvtLayover > 0 && Number(leg.EOD) == 1) {
                        // arrival-based layover rate per your rule:
                        // const layoverRate = isArrINT ? perDiem_int : perDiem_dom;
                        const layoverRate = (isDepINT || isArrINT) ? perDiem_int : perDiem_dom;
                        console.log("layoverRate", layoverRate)
                        legPay = (CvtDPOnDutyTime * legRate) + (cvtLayover * layoverRate);
                        console.log("legPay inside EOD", legPay)
                    } else {
                        // no special layover pay: pay entire leg total at flightRate
                        legPay = (CvtDPOnDutyTime + cvtLayover) * legRate;
                        console.log("legPay outside EOD", legPay)
                    }

                    tafbPay += legPay;
                }

                // sanity check vs seq.CvtTAFB
                if (Math.abs(sanityLegTAFBTotal) > 0.01) {
                    console.warn("TAFB sanity match for Seq:", seq.SeqNo, {
                        seqTAFB: tafbHours,
                        summedLegTAFB: sanityLegTAFBTotal,
                    });
                }
            }

            seq.tafbPay = tafbPay;

            console.log("LegEquip Type Array", leg_equip_types);

            // Boarding Pay
            let hourlyBoardingRate = 0;
            let boarding_type = 0;

            // Fetch Boarding Pay ROW only once (no need to fetch again & again)
            const boardingResult = await pool.request()
                .input("YearsOfService", sql.Int, yearsOfService)
                .query(`
                SELECT *
                FROM boarding_pay
                WHERE YearsOfService = @YearsOfService
            `);

            const boardingRow = boardingResult.recordset?.[0] ?? null;

            if (!boardingRow) {
                console.log("⚠️ No boarding pay row found for YearsOfService:", yearsOfService);
            }

            for (const leg of leg_equip_types) {
                const dep = (leg.dep_stn || "").toString().toUpperCase();
                const arr = (leg.arr_stn || "").toString().toUpperCase();

                const isDepINT = airportIntl[dep] == true;
                const isArrINT = airportIntl[arr] == true;

                console.log("is Dept Int", isDepINT)
                console.log("is Arr Int", isArrINT)
                // Determine flight rate (if either station is INT -> INT rate, else DOM)
                // let SeqCategory = (isDepINT || isArrINT) ? 'INT' : 'DOM'; // if IPD use that one as INT
                // if (category == 'IPD') { SeqCategory = 'IPD' };

                let SeqCategory =
                    category == 'IPD' ? 'IPD' :
                        category == 'HAW' ? 'IPD' :
                            (isDepINT || isArrINT) ? 'INT' : 'DOM';

                const positionPremiumPay = await pool.request()
                    .input("leg", sql.Int, leg.leg_equip_type)
                    .input("category", sql.NVarChar, SeqCategory)
                    .query(`
                    SELECT *
                    FROM crew_premium_pos_count
                    WHERE leg_equip_type = @leg
                    and seq_catagory = @category
                    `);
                // FROM position_premium_rate

                const posRow = positionPremiumPay.recordset?.[0] ?? null;

                console.log("leg:", leg.leg_equip_type);
                console.log("position premium pay:", posRow);

                if (!posRow || !boardingRow) {
                    continue; // skip invalid rows
                }

                // const seqCat = posRow.seq_catagory;
                const seqCat = SeqCategory;
                const boardingType = Number(posRow.boarding_type); // ensure numeric comparison
                console.log("SeqCat Array", seqCat);
                console.log("boardingType", boardingType);

                // ───────────────────────────────────────────────
                // DOMESTIC (DOM)
                // ───────────────────────────────────────────────
                if (seqCat == "DOM") {
                    if (boardingType == 35) {
                        console.log("boardingType", boardingType)
                        console.log("SeqCat", seqCat)
                        boarding_type += parseFloat(boardingRow.boarding_35_type)
                        console.log("boarding_type", boarding_type)
                        // hourlyBoardingRate += parseFloat(boardingRow.hourly_boarding_rate ?? 0);
                        hourlyBoardingRate += parseFloat(boardingRow.boarding_35_type ?? 0);
                    }
                    else if (boardingType == 40) {
                        console.log("boardingType", boardingType)
                        console.log("SeqCat", seqCat)
                        boarding_type += parseFloat(boardingRow.boarding_40_type)
                        console.log("boarding_type", boarding_type)
                        // hourlyBoardingRate += parseFloat(boardingRow.hourly_boarding_rate ?? 0);
                        hourlyBoardingRate += parseFloat(boardingRow.boarding_40_type ?? 0);
                    }
                }

                // ───────────────────────────────────────────────
                // INTERNATIONAL (INT)
                // ───────────────────────────────────────────────
                else if (seqCat == "INT") {
                    if (boardingType == 45) {
                        console.log("boardingType", boardingType)
                        console.log("SeqCat", seqCat)
                        boarding_type += parseFloat(boardingRow.boarding_45_type)
                        console.log("boarding_type", boarding_type)
                        // hourlyBoardingRate += parseFloat(boardingRo/w.hourly_boarding_rate ?? 0);
                        hourlyBoardingRate += parseFloat(boardingRow.boarding_45_type ?? 0);
                    }
                    else if (boardingType == 50) {
                        console.log("boardingType", boardingType)
                        console.log("SeqCat", seqCat)
                        boarding_type += parseFloat(boardingRow.boarding_50_type)
                        console.log("boarding_type", boarding_type)
                        // hourlyBoardingRate += parseFloat(boardingRow.hourly_boarding_rate ?? 0);
                        hourlyBoardingRate += parseFloat(boardingRow.boarding_50_type ?? 0);
                    }
                }

                // ───────────────────────────────────────────────
                // IPD / HAW
                // ───────────────────────────────────────────────
                else if (["IPD", "HAW"].includes(seqCat)) {
                    if (boardingType == 50) {
                        console.log("boardingType", boardingType)
                        console.log("SeqCat", seqCat)
                        boarding_type += parseFloat(boardingRow.boarding_50_type)
                        console.log("boarding_type", boarding_type)
                        // hourlyBoardingRate += parseFloat(boardingRow.hourly_boarding_rate ?? 0);
                        hourlyBoardingRate += parseFloat(boardingRow.boarding_50_type ?? 0);
                    }
                }

                // ───────────────────────────────────────────────
                // FALLBACK (no matching category)
                // ───────────────────────────────────────────────
                else {
                    console.log("No matching seq category for leg:", seqCat);
                }
            }
            const boardingPay = boarding_type;

            console.log("Final Boarding Pay:", hourlyBoardingRate);

            // Premium Pay
            let premiumRate = 0;
            if (category == "IPD") premiumRate = 3.75;
            else if (category == "INT" || category == "HAW") premiumRate = 3.0; // HAW = INT
            // else if (category === "SPK") premiumRate = 2.0;

            const userId = (req as any).user.id;

            const languages = await getUserLanguages(userId);

            // calculate base premiums
            const payHoursDollars = payHours * baseRate;
            const creditHoursDollars = creditHours * baseRate;
            const premiumPay = premiumHours * premiumRate;

            // default speaker pay values
            let speakerPay = 0;
            let premiumWithSpeaker = premiumPay;

            console.log("premiumWithSpeaker", premiumWithSpeaker)
            // if user has languages → apply speaker pay
            if (languages.length > 0) {
                speakerPay = premiumHours * 2;

                premiumWithSpeaker += speakerPay;
                // premiumWithSpeaker += Math.round(speakerPay);
                console.log("Languages.....", languages);
                console.log("premiumPay.....", premiumPay);
                console.log("speakerPay.....", speakerPay);
            }

            const totalEarnings =
                payHoursDollars +
                creditHoursDollars +
                tafbPay +
                premiumWithSpeaker +
                boardingPay +
                extraAmount;

            // push result
            sequences.push({
                seqNo: seq.SeqNo,
                UniqueSeqNo: seq.UniqueSeqNo,
                crewBase: seq.CrewBase,
                category: seq.SeqCategory,
                effDate: seq.EffDate instanceof Date ? seq.EffDate.toISOString().split("T")[0] : seq.EffDate,
                thruDate: seq.ThruDate instanceof Date ? seq.ThruDate.toISOString().split("T")[0] : seq.ThruDate,
                totalLegs: seq.NBR_Legs,
                totalDays: seq.NBR_Days,
                totalDuty: seq.NBR_Duty,
                seqCrewPos: seq.SeqCrewPos,
                slots: normalizeSeqCrewPos(seq.SeqCrewPos),
                bidMonth: seq.BidMonth,
                payHours: decimalHoursToHHMM(payHours),
                creditHours: decimalHoursToHHMM(creditHours),
                tafb: decimalHoursToHHMM(tafbHours),
                // sitRigHours: decimalHoursToHHMM(layOverHours),
                sitRigHours: decimalHoursToHHMMSS(layOverHours),
                seqPremiumTime: decimalHoursToHHMM(premiumHours),
                effDates,
                boardingRow,
                flightDays,
                dayWiseLegs,
                earnings: {
                    sitRig: extraAmount.toFixed(2),
                    yearsOfService,
                    baseRate,
                    tafbHours,
                    tafbPay: tafbPay.toFixed(2),
                    payHoursDollars: payHoursDollars.toFixed(2),
                    creditHoursDollars: creditHoursDollars.toFixed(2),
                    premiumPay: premiumWithSpeaker.toFixed(2),
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

        const now = new Date();
        let effectiveYear = now.getUTCFullYear();
        const oct1ThisYearUTC = new Date(Date.UTC(effectiveYear, 9, 1));
        if (now < oct1ThisYearUTC) effectiveYear -= 1;
        const perDiemEffectiveDateUTC = new Date(Date.UTC(effectiveYear, 9, 1));

        const perDiemResult = await pool.request()
            .input("perDiemDate", sql.Date, perDiemEffectiveDateUTC)
            .query(`
                SELECT TOP 1 effective_date, dom, int
                FROM PerDiem
                WHERE effective_date <= @perDiemDate
                ORDER BY effective_date DESC
            `);
        const perDiemRow = perDiemResult.recordset?.[0] ?? null;
        const perDiem_dom = perDiemRow ? parseFloat(perDiemRow.dom || 0) : 0;
        const perDiem_int = perDiemRow ? parseFloat(perDiemRow.int || 0) : 0;
        // return res.json({ perDiem_int });
        // return res.json({ perDiem_dom });
        // ---------- fetch airports once ----------
        const airportResult = await pool.request().query(`
            SELECT IATA_Code, IsInternational
            FROM Airports
        `);
        const airportRows = airportResult.recordset || [];
        const airportIntl: Record<string, boolean> = {};
        airportRows.forEach(a => {
            if (a && a.IATA_Code) airportIntl[a.IATA_Code.toUpperCase()] = a.IsInternational == 1;
        });

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

            const service = crewId ? await getCrewPayDetails(crewId) : null;
            const yearsOfService = service?.basePay?.YearsOfService ?? 1;
            const baseRate = await getDynamicBaseRate(yearsOfService); // $ per hour

            const EXTRA_LIMIT_MINUTES = 150; // 2 hours 30 minutes
            let extraAmount = 0;
            let layOverHours = 0;
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
                    // flyingHours: formatMinutes(leg.LegTotalFlying || 0),
                    flyingHours: leg.CvtLegTotalFlying || 0,
                    legPc: leg.LegPC,
                    layover: leg.CvtLayover ? leg.CvtLayover : null,
                    eod: leg.EOD
                });

                /* 👉 ADDITION STARTS (NO CHANGE ABOVE) */

                const nextLeg = seqLegs[index + 1];
                // new
                if (
                    nextLeg &&
                    leg.CvtArvTime &&
                    nextLeg.CvtDptTime &&
                    leg.EOD == 0
                ) {
                    const [ah, am, as = 0] = leg.CvtArvTime.split(":").map(Number);
                    const [dh, dm, ds = 0] = nextLeg.CvtDptTime.split(":").map(Number);

                    const arrSeconds = ah * 3600 + am * 60 + as;
                    const depSeconds = dh * 3600 + dm * 60 + ds;

                    let diffSeconds = depSeconds - arrSeconds;

                    // overnight handling
                    if (diffSeconds < 0) {
                        diffSeconds += 24 * 3600;
                    }

                    const extraLimitSeconds = EXTRA_LIMIT_MINUTES * 60;

                    if (diffSeconds > extraLimitSeconds) {
                        let extraSeconds = diffSeconds - extraLimitSeconds;

                        // SIT RIG rule: half pay
                        extraSeconds = Math.floor(extraSeconds / 2);

                        const extraHours = Math.floor(extraSeconds / 3600);
                        const extraMins = Math.floor((extraSeconds % 3600) / 60);
                        const extraSecs = extraSeconds % 60;

                        const totalExtraHours =
                            extraHours +
                            extraMins / 60 +
                            extraSecs / 3600;

                        layOverHours += totalExtraHours;
                        extraAmount += totalExtraHours * baseRate;

                        console.log(
                            `Extra time between leg ${leg.SeqLegNo} → ${nextLeg.SeqLegNo}: ` +
                            `${extraHours}h ${extraMins}m ${extraSecs}s | Pay: ${extraAmount.toFixed(2)}`
                        );
                    }
                }
                /* 👉 ADDITION ENDS */

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
            // new
            const cvtSeqPC = toDecimalHours(seq.CvtSeqPC);
            const cvtSeqFlyTime = toDecimalHours(seq.CvtSeqFlyTime);
            const cvtTAFB = toDecimalHours(seq.CvtTAFB);
            const cvtSeqPremTime = toDecimalHours(seq.CvtSeqPremTime);

            const deadheadResult = await pool.request()
                .input("seqNo", sql.Int, seq.SeqNo)
                .query(`
                    SELECT SUM(TRY_CAST(CvtDPDeadheadTime AS FLOAT)) AS TotalDPDeadheadHours
                    FROM dbo.Leg
                    WHERE SeqNo = @seqNo
                      AND DPDeadheadTime = 1
                `);
            const cvtDPDeadheadTime = toDecimalHours(deadheadResult.recordset?.[0]?.TotalDPDeadheadHours ?? 0);

            // const payHours = cvtSeqPC + cvtDPDeadheadTime + cvtSeqFlyTime;
            const payHours = 0;
            const creditHours = cvtSeqPC + cvtSeqFlyTime;
            let tafbHours = cvtTAFB;
            const premiumHours = cvtSeqPremTime;

            const category = seq.SeqCategory?.toUpperCase() ?? "DOM";
            const premiumTranscon = seq.PremiumTranscon;

            // -------------------------
            // PER DIEM / TAFB PAY LOGIC
            // -------------------------

            let tafbPay = 0;
            let sanityLegTAFBTotal = 0;

            // CASE 1: DOM / IPD / HAW -> simple sequence-level rate
            const leg_equip_types: any[] = [];
            if (category == "DOM") {
                const perDiemRate = premiumTranscon !== 1 ? perDiem_dom : perDiem_int;
                // return res.json({ perDiemRate })
                tafbPay = tafbHours * perDiemRate;

                leg_equip_types.push(
                    ...seqLegs.map(leg => ({
                        leg_equip_type: leg.LegEqupType,
                        dep_stn: leg.DeptStn,
                        arr_stn: leg.ArrvStn
                    }))
                );
            }

            // RESET FOR EACH SEQUENCE

            else if (["IPD", "HAW"].includes(category)) {
                const perDiemRate = perDiem_int;
                tafbPay = tafbHours * perDiemRate;

                // Correct: push into OUTER array (do NOT redeclare!!)
                leg_equip_types.push(
                    ...seqLegs.map(leg => ({
                        leg_equip_type: leg.LegEqupType,
                        dep_stn: leg.DeptStn,
                        arr_stn: leg.ArrvStn
                    }))
                );

                console.log("DOM/IPD/HAW Equip Types:", leg_equip_types);
            }
            // CASE 2: INT -> per-leg detailed calculation
            // old
            else if (category == "INT") {

                for (const leg of seqLegs) {
                    console.log("seqLegs Inside the Sequence", seqLegs)
                    console.log("Inside the International")
                    // leg CvtLegTAFBTotal should include flying + layover total if present
                    const CvtDPOnDutyTime = toDecimalHours(leg.CvtDPOnDutyTime);
                    // prefer explicit layover column if available
                    const cvtLayover = toDecimalHours(leg.CvtLayover ?? leg.CvtLayover ?? 0);

                    sanityLegTAFBTotal += (CvtDPOnDutyTime + cvtLayover);

                    const dep = (leg.DeptStn || "").toString().toUpperCase();
                    const arr = (leg.ArrvStn || "").toString().toUpperCase();

                    const isDepINT = airportIntl[dep] == true;
                    const isArrINT = airportIntl[arr] == true;

                    // Determine flight rate (if either station is INT -> INT rate, else DOM)
                    const flightRate = (isDepINT || isArrINT) ? perDiem_int : perDiem_dom;

                    // ---- IMPORTANT: EOD layover handling ----
                    // If EOD === 1 => apply arrival-based rate to layoverHours.
                    // If EOD !== 1 => include layover in flightPart and pay at flightRate (no special layover pay).
                    let legPay = 0;
                    if (cvtLayover > 0 && Number(leg.EOD) == 1) {
                        // arrival-based layover rate per your rule:
                        // const layoverRate = isArrINT ? perDiem_int : perDiem_dom;
                        const layoverRate = (isDepINT || isArrINT) ? perDiem_int : perDiem_dom;
                        console.log("layoverRate", layoverRate)
                        legPay = (CvtDPOnDutyTime * flightRate) + (cvtLayover * layoverRate);
                        console.log("legPay inside EOD", legPay)
                    } else {
                        // no special layover pay: pay entire leg total at flightRate
                        legPay = (CvtDPOnDutyTime + cvtLayover) * flightRate;
                        console.log("legPay outside EOD", legPay)
                    }

                    tafbPay += legPay;

                    leg_equip_types.push({
                        leg_equip_type: leg.LegEqupType,
                        dep_stn: leg.DeptStn,
                        arr_stn: leg.ArrvStn,
                    });

                    console.log("Leg Equip Type:", leg_equip_types);
                    console.log("==......>>>>", tafbPay)
                }

                // sanity check vs seq.CvtTAFB
                if (Math.abs(sanityLegTAFBTotal - tafbHours) > 0.01) {
                    console.warn("TAFB sanity mismatch for Seq:", seq.SeqNo, {
                        seqTAFB: tafbHours,
                        summedLegTAFB: sanityLegTAFBTotal,
                    });
                }
            }
            seq.tafbPay = tafbPay;

            // return res.json({ seq.tafbPay })
            // ================================

            // // Fetch Boarding Pay ROW only once (no need to fetch again & again)
            const boardingResult = await pool.request()
                .input("YearsOfService", sql.Int, yearsOfService)
                .query(`
                SELECT *
                FROM boarding_pay
                WHERE YearsOfService = @YearsOfService
            `);

            const boardingRow = boardingResult.recordset?.[0] ?? null;

            if (!boardingRow) {
                console.log("⚠️ No boarding pay row found for YearsOfService:", yearsOfService);
            }

            let totalBoardingPay = 0;

            for (const leg of leg_equip_types) {

                const dep = (leg.dep_stn || "").toString().toUpperCase();
                const arr = (leg.arr_stn || "").toString().toUpperCase();

                const isDepINT = airportIntl[dep] == true;
                const isArrINT = airportIntl[arr] == true;

                console.log("is Dept Int", isDepINT)
                console.log("is Arr Int", isArrINT)
                // Determine flight rate (if either station is INT -> INT rate, else DOM)
                let SeqCategory = (isDepINT || isArrINT) ? 'INT' : 'DOM'; // if IPD use that one as INT
                if (category == 'IPD') { SeqCategory = 'IPD' };

                const positionPremiumPay = await pool.request()
                    .input("leg_equip_type", sql.Int, leg.leg_equip_type)
                    .input("category", sql.NVarChar, SeqCategory)
                    .query(`
                        SELECT *
                        FROM crew_premium_pos_count
                        WHERE leg_equip_type = @leg_equip_type
                        AND seq_catagory = @category
                        `);
                // FROM position_premium_rate

                const posRow = positionPremiumPay.recordset?.[0] ?? null;

                if (!posRow || !boardingRow) continue;

                // return res.json({ category });
                const seqCat = SeqCategory;
                const boardingType = Number(posRow.boarding_type);
                let boardingHours = 0;

                if (seqCat == "DOM") {
                    // return res.json({ boardingType });
                    if (boardingType == 35) boardingHours = Number(boardingRow.boarding_35_type);
                    else if (boardingType == 40) boardingHours = Number(boardingRow.boarding_40_type);
                }
                else if (seqCat == "INT") {
                    if (boardingType == 45) boardingHours = Number(boardingRow.boarding_45_type);
                    else if (boardingType == 50) boardingHours = Number(boardingRow.boarding_50_type);
                }
                else if (["IPD", "HAW"].includes(seqCat)) {
                    if (boardingType == 50) boardingHours = Number(boardingRow.boarding_50_type);
                }

                const rate = Number(boardingRow.hourly_boarding_rate ?? 0);

                // ⭐ The CORRECT calculation
                // totalBoardingPay += rate;
                totalBoardingPay += boardingHours;

                console.log("BOARDING HOURS:", boardingHours);
                console.log("RATE:", rate);
                console.log("Boarding Pay:", totalBoardingPay);
                console.log("LEG BOARDING PAY:", boardingHours * rate);
            }

            const userId = (req as any).user.id;

            const languages = await getUserLanguages(userId);

            // calculate base premiums
            // const payHoursDollars = payHours * baseRate;
            // const creditHoursDollars = creditHours * baseRate;
            // const premiumPay = premiumHours * premiumRate;

            // default speaker pay values
            let premiumPay = 0;
            let speakerPay = 0;

            // 6) Premium pay rules (per your doc)
            let premiumRatePerHour = 0;
            if (seq.SeqCategory == "IPD") premiumRatePerHour = 3.75;
            else if (seq.SeqCategory == "INT" || seq.SeqCategory == 'HAW') premiumRatePerHour = 3.00;
            // else if (seq.SeqCategory === "SPK") premiumRatePerHour = 2.00;
            else premiumRatePerHour = 0;             // TAFB $

            const payHoursDollars = parseFloat((payHours * (baseRate || 0)).toFixed(2));
            const creditHoursDollars = parseFloat((creditHours * (baseRate || 0)).toFixed(2));
            // const tafbPay = parseFloat((tafbHours * (perDiemRate || 0)).toFixed(2));
            premiumPay = parseFloat((premiumHours * (premiumRatePerHour || 0)).toFixed(2));

            let premiumWithSpeaker = premiumPay;

            // if user has languages → apply speaker pay
            if (languages.length > 0) {
                speakerPay = premiumHours * 2;
                // premiumWithSpeaker += Math.round(speakerPay);

                premiumWithSpeaker += speakerPay;
                console.log("Languages.....", languages);
            }

            // 8) Total sequence earnings
            const totalSequenceEarnings = Number(
                payHoursDollars +
                creditHoursDollars +
                tafbPay +
                premiumWithSpeaker +
                totalBoardingPay
                // extraAmount
            );

            // 9) Prepare the same output shape as before (frontend unchanged).
            //    formatMinutes() in your code expects minutes, so convert hours->minutes for formatting fields.
            sequences.push({
                ...seq,
                lastArrvStn: seqLegs.length > 0 ? seqLegs[seqLegs.length - 1].ArrvStn : null,
                slots: normalizeSeqCrewPos(seq.SeqCrewPos),

                // format fields: convert hours -> minutes for formatMinutes/toHHmm
                // payHours: formatMinutes(Math.round(payHoursHours * 60)),               // "HH:mm"
                // creditHours: formatMinutes(Math.round(seqCreditHoursHours * 60)),      // "HH:mm"
                // tafb: formatMinutes(Math.round(seqTafbHours * 60)),                   // "HH:mm"
                // seqPremiumTime: toHHmm(Math.round(seqPremiumHours * 60)),             // "HH:mm"
                payHours: formatMinutes(Math.round(payHours * 60)),               // "HH:mm"
                creditHours: formatMinutes(Math.round(creditHours * 60)),      // "HH:mm"
                tafb: formatMinutes(Math.round(tafbHours * 60)),                   // "HH:mm"
                // sitRigHours: decimalHoursToHHMM(layOverHours),
                sitRigHours: decimalHoursToHHMMSS(layOverHours),
                seqPremiumTime: toHHmm(Math.round(premiumHours * 60)),             // "HH:mm"

                // Day/flight info unchanged
                totalFlyingDays: flightDays.length,
                flightDays,
                dayWiseLegs,

                earnings: {
                    yearsOfService,
                    baseRate,
                    // extraAmount,
                    sitRig: extraAmount.toFixed(2),
                    tafbPay: tafbPay.toFixed(2),                    // $ per hour (per-diem)
                    tafbHours,
                    tafPerDiem: tafbPay.toFixed(2),
                    payHours,                   // hours (raw)
                    cvtDPDeadheadTime,            // hours added from legs
                    payHoursDollars: payHoursDollars.toFixed(2),
                    creditHoursDollars: creditHoursDollars.toFixed(2),
                    premiumPay: premiumWithSpeaker.toFixed(2),
                    totalBoardingPay: totalBoardingPay.toFixed(2),
                    totalSequenceEarnings: totalSequenceEarnings.toFixed(2)
                },

                legs: seqLegs.map((leg: any) => ({
                    seqNo: leg.SeqNo,
                    seqLegNo: leg.SeqLegNo,
                    departure: leg.DeptStn,
                    arrival: leg.ArrvStn,
                    flightNo: leg.FitNo,
                    dptTime: leg.CvtDptTime,
                    arvTime: leg.CvtArvTime,
                    flyingHours: leg.CvtLegTotalFlying,
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
        const uniqueSeqNo = (req.query.uniqueSeqNo as string);
        // const effDate = new Date(req.query.effDate as string);
        // const effDate = req.query.effDate as string; // "2025-11-17"
        const effDate = (req.query.effDate as string);

        const sequences: any[] = [];

        if (!uniqueSeqNo) {
            return res.status(400).json({ message: "uniqueSeqNo is required and must be numeric" });
        }
        if (!req.query.effDate) {
            return res.status(400).json({ message: "effDate is required" });
        }

        const data = await findByDateAndSeqNo(uniqueSeqNo, effDate);
        console.log("Frequency Date", effDate)
        console.log("Frequency Date", effDate)

        if (!data) {
            return res.status(404).json({ message: "No sequence found for given seqNo and frequency_date" });
        }
        for (const dt of data) {
            sequences.push({
                ...dt,
                slots: normalizeSeqCrewPos(dt.SeqCrewPos),
            });
        }
        return res.status(200).json({
            message: "Data Fetched Successfully",
            data: sequences,
        });
    } catch (error: any) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            message: Messages.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};

// old
// export const filterByDate = async (req: Request, res: Response): Promise<any> => {
//     try {
//         const seqNo = Number(req.query.seqNo);
//         const effDates = new Date(req.query.effDate as string);
//         // const effDate = req.query.effDate as string; // "2025-11-17"
//         const effDate = (req.query.effDate as string).split("T")[0];

//         if (!seqNo || isNaN(seqNo)) {
//             return res.status(400).json({ message: "seqNo is required and must be numeric" });
//         }
//         if (!req.query.effDate) {
//             return res.status(400).json({ message: "effDate is required" });
//         }

//         const data = await findByDateAndSeqNo(seqNo, effDate);
//         console.log("Eff Date", effDate)
//         console.log("Eff Dates", effDates)

//         if (!data) {
//             return res.status(404).json({ message: "No legs found for given seqNo and effDate" });
//         }

//         // let noOfBoardings = 0;
//         // Prepare UI-ready leg summary
//         const formatted = data.map(leg => ({
//             seqNo: leg.SeqNo,
//             seqLegNo: leg.SeqLegNo,
//             departure: leg.DeptStn,
//             arrival: leg.ArrvStn,
//             flightNo: leg.FitNo,
//             // dptTime: toHHmm(leg.DptTime),
//             // arvTime: toHHmm(leg.ArvTime),
//             dptTime: leg.CvtDptTime,
//             arvTime: leg.CvtArvTime,
//             flyingHours: formatMinutes(leg.LegTotalFlying),
//             pc: leg.LegPC,
//             // boardingTime: calculateBoardingTime(leg.DptTime ),
//             // boardingTime: toHHmm(leg.DptTime - 30),
//             layover: leg.Layover ? formatMinutes(leg.Layover) : null,
//             eod: leg.EOD
//         }));

//         return res.status(200).json({
//             message: "Legs Fetched Successfully",
//             sequence: formatted,
//         });
//     } catch (error: any) {
//         return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
//             message: Messages.INTERNAL_SERVER_ERROR,
//             error: error.message
//         });
//     }
// };

export const applyPosition = async (req: Request, res: Response): Promise<any> => {
    try {
        // const { seqNo, position, effDate, bidMonth } = req.body;
        const { uniqueSeqNo, position, effDate, bidMonth, l_r_type } = req.body;
        const userId = (req as any).user.id
        if (!uniqueSeqNo || !position) {
            return res.status(StatusCode.BAD_REQUEST).json({ message: "seqNo and position are required" });
        }

        // return res.json({ l_r_type });

        const checkAlreadyAppliedOnSequnce = await checkAlreadyApplied(uniqueSeqNo, bidMonth, effDate, userId)
        if (checkAlreadyAppliedOnSequnce) {
            return res.status(409).json({ "message": "Already Applied on this sequence" });
        }

        const updatedSeqCrewPos = await updatePosition(uniqueSeqNo, Number(position), effDate, bidMonth);
        // return res.json({ updatedSeqCrewPos });
        if (!updatedSeqCrewPos) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

        const newUserSequenceId = await addSequenceDataInUserSequence(userId, updatedSeqCrewPos, position, effDate, updatedSeqCrewPos.originalDigit, l_r_type);
        const newUserLegId = await addLegDataInUserLeg(userId, uniqueSeqNo, bidMonth, effDate, newUserSequenceId);

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

        const now = new Date();
        let effectiveYear = now.getUTCFullYear();
        const oct1ThisYearUTC = new Date(Date.UTC(effectiveYear, 9, 1));
        if (now < oct1ThisYearUTC) effectiveYear -= 1;
        const perDiemEffectiveDateUTC = new Date(Date.UTC(effectiveYear, 9, 1));
        const pool = await getPool();

        const perDiemResult = await pool.request()
            .input("perDiemDate", sql.Date, perDiemEffectiveDateUTC)
            .query(`
                SELECT TOP 1 effective_date, dom, int
                FROM PerDiem
                WHERE effective_date <= @perDiemDate
                ORDER BY effective_date DESC
            `);
        const perDiemRow = perDiemResult.recordset?.[0] ?? null;
        const perDiem_dom = perDiemRow ? parseFloat(perDiemRow.dom || 0) : 0;
        const perDiem_int = perDiemRow ? parseFloat(perDiemRow.int || 0) : 0;

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
            jurydutyPay: pay,
            understaffingPay: understaffingPayRate,
            hotel1HourDelayPay: "100% of Same Day Trips",
            hotel3HoursDelayPay: "100% of Full Sequence",
            standbyPay: pay,
        }

        const perDiems = {
            domesticRate: perDiem_dom,
            internationalRate: perDiem_int
        }

        const boardingPay = {
            min35: boardingPayRate?.boarding_35_type,
            min40: boardingPayRate?.boarding_40_type,
            min45: boardingPayRate?.boarding_45_type,
            min50: boardingPayRate?.boarding_50_type,
            min55: boardingPayRate?.boarding_55_type
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

// old
// export const deleteSequence = async (req: Request, res: Response): Promise<any> => {
//     try {
//         const { userId, uniqueSeqNo, effDate } = req.body;

//         if (!userId || !uniqueSeqNo || !effDate) {
//             return res
//                 .status(StatusCode.BAD_REQUEST)
//                 .json({ message: "userId, uniqueSeqNo, and effDate are required." });
//         }
//         // const { userId, seqNo, bidMonth } = req.body;

//         // if (!userId || !seqNo || !bidMonth) {
//         //     return res
//         //         .status(StatusCode.BAD_REQUEST)
//         //         .json({ message: "userId, seqNo, and bidMonth are required." });
//         // }

//         const pool = await getPool();

//         // Step 1: Fetch the UserSequence record (we need the PositionAppliedOn)
//         const { recordset: sequenceResult } = await pool
//             .request()
//             .input("UserID", userId)
//             .input("UniqueSeqNo", uniqueSeqNo)
//             // .input("BidMonth", bidMonth)
//             .input("effDate", effDate)
//             .query(`
//                 SELECT TOP 1 UserSequenceID, PositionAppliedOn, PositionAppliedOnLetter
//                 FROM UserSequence 
//                 WHERE UserID = @UserID AND UniqueSeqNo = @UniqueSeqNo AND EffDate = @effDate
//             `);
//         // WHERE UserID = @UserID AND SeqNo = @SeqNo AND BidMonth = @BidMonth

//         if (sequenceResult.length === 0) {
//             return res
//                 .status(StatusCode.NOT_FOUND)
//                 .json({ message: "No sequence found for this user." });
//         }

//         const userSequenceId = sequenceResult[0].UserSequenceID;
//         const positionAppliedOn = sequenceResult[0].PositionAppliedOn;
//         const positionAppliedOnLetter = sequenceResult[0].PositionAppliedOnLetter;

//         // return res.json({ sequenceResult });

//         // Step 2: Begin transaction
//         const transaction = pool.transaction();
//         await transaction.begin();

//         try {
//             // Step 3: Fetch the current SeqCrewPos for this sequence
//             const { recordset: seqData } = await transaction
//                 .request()
//                 // .input("SeqNo", seqNo)
//                 // .input("BidMonth", bidMonth)
//                 .input("UniqueSeqNo", uniqueSeqNo)
//                 .input("effDate", effDate)
//                 .query(`
//                     SELECT SeqCrewPos 
//                     FROM Sequence 
//                     WHERE UniqueSeqNo = @UniqueSeqNo AND EffDate = @effDate
//                 `);
//             //   WHERE SeqNo = @SeqNo AND BidMonth = @BidMonth
//             console.log("++++>>>>", positionAppliedOnLetter)
//             // return res.json({ seqData });
//             if (seqData.length > 0) {
//                 // let seqCrewPos = seqData[0].SeqCrewPos;
//                 let seqCrewPos = seqData[0].SeqCrewPos;
//                 let seqCrewPosArr = seqCrewPos.split("");

//                 // Step 4: Revert that position back to "1" (make it available again)
//                 if (positionAppliedOn > 0 && positionAppliedOn <= seqCrewPosArr.length) {
//                     seqCrewPosArr[positionAppliedOn - 1] = positionAppliedOnLetter.trim();
//                 }

//                 // return res.json({ seqCrewPosArr });
//                 const updatedSeqCrewPos = seqCrewPosArr.join("");
//                 // return res.json({ updatedSeqCrewPos });

//                 console.log("Length:", updatedSeqCrewPos.length);
//                 console.log("Value:", JSON.stringify(updatedSeqCrewPos));

//                 // Step 5: Update Sequence table
//                 await transaction
//                     .request()
//                     // .input("SeqNo", seqNo)
//                     // .input("BidMonth", bidMonth)
//                     .input("UniqueSeqNo", uniqueSeqNo)
//                     .input("effDate", effDate)
//                     .input("SeqCrewPos", sql.VarChar(20), updatedSeqCrewPos)
//                     .query(`
//                         UPDATE Sequence
//                         SET SeqCrewPos = @SeqCrewPos
//                         WHERE UniqueSeqNo = @uniqueSeqNo AND EffDate = @effDate
//                     `);
//                 await transaction
//                     .request()
//                     // .input("SeqNo", seqNo)
//                     // .input("BidMonth", bidMonth)
//                     .input("UniqueSeqNo", uniqueSeqNo)
//                     .input("effDate", effDate)
//                     .input("SeqCrewPos", sql.VarChar(20), updatedSeqCrewPos)
//                     .query(`
//                         UPDATE Frequency
//                         SET SeqCrewPos = @SeqCrewPos
//                         WHERE UniqueSeqNo = @uniqueSeqNo AND frequency_date = @effDate
//                     `);
//             }
//             else {
//                 await transaction
//                     .request()
//                     // .input("SeqNo", seqNo)
//                     // .input("BidMonth", bidMonth)
//                     .input("UniqueSeqNo", uniqueSeqNo)
//                     .input("effDate", effDate)
//                     .input("SeqCrewPos", sql.VarChar(20), updatedSeqCrewPos)
//                     .query(`
//                         UPDATE Frequency
//                         SET SeqCrewPos = @SeqCrewPos
//                         WHERE UniqueSeqNo = @uniqueSeqNo AND frequency_date = @effDate
//                     `);
//             }

//             // Step 6: Delete associated UserLegs
//             await transaction
//                 .request()
//                 .input("UserSequenceID", userSequenceId)
//                 .query(`DELETE FROM UserLeg WHERE UserSequenceID = @UserSequenceID`);

//             // Step 7: Delete the UserSequence
//             await transaction
//                 .request()
//                 .input("UserSequenceID", userSequenceId)
//                 .query(`DELETE FROM UserSequence WHERE UserSequenceID = @UserSequenceID`);

//             // Step 8: Commit transaction
//             await transaction.commit();

//             console.log(`✅ Sequence ${userSequenceId} deleted and position reverted successfully.`);

//             return res.status(StatusCode.OK).json({
//                 message: "Sequence deleted and position made available again."
//             });

//         } catch (innerError: any) {
//             await transaction.rollback();
//             console.error("❌ Transaction rolled back:", innerError);
//             return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
//                 message: "Internal Server Error",
//                 error: innerError.message
//             });
//         }

//     } catch (error: any) {
//         console.error("Error in deleteSequence:", error);
//         return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
//             message: "Internal Server Error",
//             error: error.message
//         });
//     }
// };

// === API endpoint to test manually in Postman ===

// new

// new

export const deleteSequence = async (req: Request, res: Response): Promise<any> => {
    try {
        const { userId, uniqueSeqNo, effDate } = req.body;

        if (!userId || !uniqueSeqNo || !effDate) {
            return res.status(StatusCode.BAD_REQUEST).json({
                message: "userId, uniqueSeqNo, and effDate are required."
            });
        }

        const pool = await getPool();

        // 1️⃣ Get UserSequence (outside transaction is OK for read)
        const { recordset: sequenceResult } = await pool.request()
            .input("UserID", userId)
            .input("UniqueSeqNo", uniqueSeqNo)
            .input("effDate", effDate)
            .query(`
            SELECT TOP 1 UserSequenceID, PositionAppliedOn, PositionAppliedOnLetter
            FROM UserSequence 
            WHERE UserID = @UserID 
            AND UniqueSeqNo = @UniqueSeqNo 
            AND EffDate = @effDate
        `);

        if (sequenceResult.length === 0) {
            return res.status(StatusCode.NOT_FOUND).json({
                message: "No sequence found for this user."
            });
        }

        const userSequenceId = sequenceResult[0].UserSequenceID;
        const positionAppliedOn = sequenceResult[0].PositionAppliedOn;
        const positionAppliedOnLetter = sequenceResult[0].PositionAppliedOnLetter;

        // 2️⃣ START TRANSACTION
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 3️⃣ Lock Sequence row
            let request = new sql.Request(transaction);

            const seqResult = await request
                .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
                .input("effDate", sql.NVarChar, effDate)
                .query(`
                SELECT SeqCrewPos
                FROM Sequence WITH (UPDLOCK, HOLDLOCK)
                WHERE UniqueSeqNo = @uniqueSeqNo 
                AND EffDate = @effDate
            `);

            const seqExists = seqResult.recordset.length > 0;

            // 4️⃣ Lock Frequency row
            request = new sql.Request(transaction);

            const freqResult = await request
                .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
                .input("effDate", sql.NVarChar, effDate)
                .query(`
                SELECT SeqCrewPos
                FROM Frequency WITH (UPDLOCK, HOLDLOCK)
                WHERE UniqueSeqNo = @uniqueSeqNo 
                AND frequency_date = @effDate
            `);

            const freqExists = freqResult.recordset.length > 0;

            // ❗ Decide source
            const sourceRow = seqExists
                ? seqResult.recordset[0]
                : freqExists
                    ? freqResult.recordset[0]
                    : null;

            if (!sourceRow) {
                await transaction.rollback();
                return res.status(404).json({ message: "No data found to update." });
            }

            let seqCrewPosArr = sourceRow.SeqCrewPos.split("");

            // 5️⃣ Revert position
            if (positionAppliedOn > 0 && positionAppliedOn <= seqCrewPosArr.length) {
                seqCrewPosArr[positionAppliedOn - 1] = positionAppliedOnLetter.trim();
            }

            const updatedSeqCrewPos = seqCrewPosArr.join("");
            console.log("updated Seq Crew Pos", updatedSeqCrewPos);
            // 6️⃣ Update Sequence ONLY if exists
            if (seqExists) {
                request = new sql.Request(transaction);

                await request
                    .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
                    .input("effDate", sql.NVarChar, effDate)
                    .input("SeqCrewPos", sql.VarChar(20), updatedSeqCrewPos)
                    .query(`
                    UPDATE Sequence
                    SET SeqCrewPos = @SeqCrewPos
                    WHERE UniqueSeqNo = @uniqueSeqNo 
                    AND EffDate = @effDate
                `);
            }

            // 7️⃣ Update Frequency ONLY if exists
            if (freqExists) {
                request = new sql.Request(transaction);

                await request
                    .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
                    .input("effDate", sql.NVarChar, effDate)
                    .input("SeqCrewPos", sql.VarChar(20), updatedSeqCrewPos)
                    .query(`
                    UPDATE Frequency
                    SET SeqCrewPos = @SeqCrewPos
                    WHERE UniqueSeqNo = @uniqueSeqNo 
                    AND frequency_date = @effDate
                `);
            }

            // 8️⃣ Delete UserLegs
            request = new sql.Request(transaction);
            await request
                .input("UserSequenceID", userSequenceId)
                .query(`DELETE FROM UserLeg WHERE UserSequenceID = @UserSequenceID`);

            // 9️⃣ Delete UserSequence
            request = new sql.Request(transaction);
            await request
                .input("UserSequenceID", userSequenceId)
                .query(`DELETE FROM UserSequence WHERE UserSequenceID = @UserSequenceID`);

            // 🔟 Commit
            await transaction.commit();

            return res.status(StatusCode.OK).json({
                message: "Sequence deleted and position restored successfully."
            });

        } catch (innerError: any) {
            await transaction.rollback();
            return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
                message: "Transaction failed",
                error: innerError.message
            });
        }

    } catch (error: any) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
};

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

export const get12MonthSequenceData = async (req: Request, res: Response): Promise<any> => {
    try {

        const { bidYear } = req.query;

        if (!bidYear) {
            return res.status(400).json({ message: "bidYear is required" });
        }

        const pool = await getPool();

        const result = await pool.request()
            .input("bidYear", bidYear)
            .query(`
                SELECT 
                    s.BidMonth,
                    s.BidYear,

                    COUNT(DISTINCT s.SeqNo) AS SequenceCount,
                    COUNT(l.SeqNo) AS TotalLegs,
                    
                    MIN(l.DeptStn) AS FirstDeptStn,
                    MIN(l.Date) AS StartDate,
                    MAX(l.Date) AS EndDate

                FROM Sequence s
                LEFT JOIN Leg l ON s.SeqNo = l.SeqNo
                WHERE s.BidYear = @bidYear
                GROUP BY s.BidMonth, s.BidYear
                ORDER BY MIN(s.EffDate)
            `)

        return res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (error: any) {
        console.error("Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch data",
            error: error.message,
        });
    }
};

// new 2
export const searchByMonth = async (req: Request, res: Response): Promise<any> => {
    try {

        const { crewBase, seqNo, bidMonth } = req.query;

        if (!bidMonth) {
            return res.status(400).json({ message: "bidMonth is required" });
        }

        if (!crewBase) {
            return res.status(400).json({ message: "crewbase is required" });
        }

        console.time("SQL_TIME");
        const sequenceData = await findByBidMonth(crewBase as string, bidMonth as string);
        // return res.json({ sequenceData })
        if (!sequenceData.length) {
            return res.status(404).json({ message: "No sequence found for the given SeqNo and BidMonth." });
        }

        const pool = await getPool();

        // ---------- helpers ----------
        const toDecimalHours = (value: any): number => {
            if (value === null || value === undefined || value === "") return 0;
            if (typeof value === "number") return value;
            if (typeof value === "string") {
                // "HH:MM"
                if (value.includes(":")) {
                    const [hhRaw, mmRaw] = value.split(":");
                    const hh = Number(hhRaw) || 0;
                    const mm = Number(mmRaw) || 0;
                    return hh + mm / 60;
                }
                // decimal string
                if (value.includes(".")) return parseFloat(value) || 0;
                // integer string: treat as hours
                const asNum = parseFloat(value);
                if (!isNaN(asNum)) return asNum;
            }
            return 0;
        };

        // ---------- fetch per-diem row (effective) ----------
        const now = new Date();
        let effectiveYear = now.getUTCFullYear();
        const oct1ThisYearUTC = new Date(Date.UTC(effectiveYear, 9, 1));
        if (now < oct1ThisYearUTC) effectiveYear -= 1;
        const perDiemEffectiveDateUTC = new Date(Date.UTC(effectiveYear, 9, 1));

        const perDiemResult = await pool.request()
            .input("perDiemDate", sql.Date, perDiemEffectiveDateUTC)
            .query(`
                SELECT TOP 1 effective_date, dom, int
                FROM PerDiem
                WHERE effective_date <= @perDiemDate
                ORDER BY effective_date DESC
            `);
        const perDiemRow = perDiemResult.recordset?.[0] ?? null;
        // return res.json({ perDiemResult });
        const perDiem_dom = perDiemRow ? parseFloat(perDiemRow.dom || 0) : 0;
        const perDiem_int = perDiemRow ? parseFloat(perDiemRow.int || 0) : 0;

        // ---------- fetch airports once ----------
        const airportResult = await pool.request().query(`
            SELECT IATA_Code, IsInternational
            FROM Airports
            `);

        const airportRows = airportResult.recordset || [];
        // return res.json({ airportRows });

        // return res.json({ airportRows })
        const airportIntl: Record<string, boolean> = {};
        airportRows.forEach(a => {
            if (a && a.IATA_Code) airportIntl[a.IATA_Code.toUpperCase()] = a.IsInternational == 1;
        });

        // ---------- crew/service/base rate ----------
        const crewId = (req as any).user?.crewId;
        const service = crewId ? await getCrewPayDetails(crewId) : null;
        const yearsOfService = service?.basePay?.YearsOfService ?? 1;
        const baseRate = await getDynamicBaseRate(yearsOfService);

        const premiumResult = await pool.request().query(`
            SELECT *
            FROM crew_premium_pos_count
        `);

        const premiumRows = premiumResult.recordset || [];

        const premiumMap = new Map();

        for (const row of premiumRows) {
            const key = `${row.leg_equip_type}_${row.seq_catagory}`;
            premiumMap.set(key, row);
        }

        const uniqueSeqNos = sequenceData.map(s => s.UniqueSeqNo);

        // ---------- frequency bulk ----------
        const seqNos = sequenceData.map(s => s.SeqNo);

        // const uniqueSeqNos = sequenceData
        //     .map(s => s.UniqueSeqNo)
        //     .filter(Boolean);

        // return res.json({ uniqueSeqNos });
        // return res.json({ seqNos });

        const frequencyMap: Record<string, any[]> = {};

        if (uniqueSeqNos.length > 0) {
            const freqRequest = pool.request();

            // Add all inputs safely
            uniqueSeqNos.forEach((val, i) => {
                freqRequest.input(`u${i}`, sql.VarChar, val);
            });

            // Build IN clause referencing parameters
            const inClause = uniqueSeqNos.map((_, i) => `@u${i}`).join(",");

            const freqResult = await freqRequest.query(`
                SELECT *
                FROM Frequency
                WHERE UniqueSeqNo IN (${inClause})
            `);

            // Map by UniqueSeqNo
            freqResult.recordset.forEach(row => {
                const key = row.UniqueSeqNo?.toString();
                if (!key) return; // skip null/undefined
                if (!frequencyMap[key]) {
                    frequencyMap[key] = [];
                }
                frequencyMap[key].push(row);
            });
        }

        // Later, inside loop
        // ---------- deadhead bulk ----------
        const seqNumbers = sequenceData
            .map(s => s.SeqNo)
            .filter(Boolean);

        const deadheadMap: Record<number, number> = {};

        if (seqNumbers.length > 0) {
            const deadheadRequest = pool.request();

            seqNumbers.forEach((val, i) => {
                deadheadRequest.input(`s${i}`, sql.Int, val);
            });

            const deadheadResult = await deadheadRequest.query(`
            SELECT SeqNo,
                SUM(TRY_CAST(CvtDPDeadheadTime AS FLOAT)) AS TotalDPDeadheadHours
            FROM dbo.Leg
            WHERE SeqNo IN (${seqNumbers.map((_, i) => `@s${i}`).join(",")})
            AND DPDeadheadTime = 1
            GROUP BY SeqNo
        `);

            deadheadResult.recordset.forEach(r => {
                deadheadMap[r.SeqNo] = r.TotalDPDeadheadHours ?? 0;
            });
        }

        const userId = (req as any).user.id;
        const languages = await getUserLanguages(userId)
        // const seqLegs = seq.legs || [];

        // ---------- build sequences ----------
        // const leg_equip_types: any[] = [];
        const sequences: any[] = [];

        for (const seq of sequenceData) {
            const leg_equip_types: any[] = [];
            const UniqueSeqNo = seq.UniqueSeqNo;

            // const seqLegs = seq.SeqNo || [];

            const seqLegs = seq.legs || [];
            // ---- calendar/flightDays and dayWiseLegs (unchanged) ----
            const calendar = seq.Calendar_40Day || "";
            const flightDays: number[] = [];
            for (let i = 0; i < calendar.length; i++) {
                if (calendar[i] == "1") flightDays.push(i + 1);
            }

            const effDates = frequencyMap[UniqueSeqNo] || [];
            // const effDates = UniqueSeqNo ? (frequencyMap[UniqueSeqNo] || []) : [];
            // const effDates = UniqueSeqNo ? (frequencyMap[UniqueSeqNo.toString()] || []) : [];
            const EXTRA_LIMIT_MINUTES = 150; // 2 hours 30 minutes
            let extraAmount = 0;
            let layOverHours = 0;
            const dayWiseLegs: any[] = [];
            let currentDayLegs: any[] = [];
            let dayCounter = 1;
            seqLegs.forEach((leg: any, index: number) => {
                currentDayLegs.push({
                    seqNo: leg.SeqNo,
                    seqLegNo: leg.SeqLegNo,
                    departure: leg.DeptStn,
                    arrival: leg.ArrvStn,
                    flightNo: leg.FitNo,
                    // dptTime: leg.CvtDptTime,
                    dptTime: minusOneHour(leg.CvtDptTime),
                    arvTime: leg.CvtArvTime,
                    flyingHours: leg.CvtSeqFlyTime ?? leg.CvtLegTotalFlying,
                    legPc: leg.LegPC,
                    layover: leg.CvtLayover ? leg.CvtLayover : null,
                    eod: leg.EOD,
                });

                /* 👉 ADDITION STARTS (NO CHANGE ABOVE) */

                const nextLeg = seqLegs[index + 1];

                if (
                    nextLeg &&
                    leg.CvtArvTime &&
                    nextLeg.CvtDptTime &&
                    leg.EOD == 0
                ) {
                    const [ah, am, as = 0] = leg.CvtArvTime.split(":").map(Number);
                    const [dh, dm, ds = 0] = nextLeg.CvtDptTime.split(":").map(Number);

                    const arrSeconds = ah * 3600 + am * 60 + as;
                    const depSeconds = dh * 3600 + dm * 60 + ds;

                    let diffSeconds = depSeconds - arrSeconds;

                    // overnight handling
                    if (diffSeconds < 0) {
                        diffSeconds += 24 * 3600;
                    }

                    const extraLimitSeconds = EXTRA_LIMIT_MINUTES * 60;

                    if (diffSeconds > extraLimitSeconds) {
                        let extraSeconds = diffSeconds - extraLimitSeconds;

                        // SIT RIG rule: half pay
                        extraSeconds = Math.floor(extraSeconds / 2);

                        const extraHours = Math.floor(extraSeconds / 3600);
                        const extraMins = Math.floor((extraSeconds % 3600) / 60);
                        const extraSecs = extraSeconds % 60;

                        const totalExtraHours =
                            extraHours +
                            extraMins / 60 +
                            extraSecs / 3600;

                        layOverHours += totalExtraHours;
                        extraAmount += totalExtraHours * baseRate;

                        console.log(
                            `Extra time between leg ${leg.SeqLegNo} → ${nextLeg.SeqLegNo}: ` +
                            `${extraHours}h ${extraMins}m ${extraSecs}s | Pay: ${extraAmount.toFixed(2)}`
                        );
                    }
                }

                /* 👉 ADDITION ENDS */

                if (leg.EOD == 1) {
                    dayWiseLegs.push({ day: dayCounter, legs: currentDayLegs });
                    currentDayLegs = [];
                    dayCounter++;
                }

                leg_equip_types.push({
                    leg_equip_type: leg.LegEqupType,
                    dep_stn: leg.DeptStn,
                    arr_stn: leg.ArrvStn
                });

            });
            // };// for loop
            if (currentDayLegs.length > 0) dayWiseLegs.push({ day: dayCounter, legs: currentDayLegs });
            // console.log("Leg Equip Type:", leg_equip_types);
            // return res.json({ currentDayLegs })
            // ---- core hours ----
            const cvtSeqPC = toDecimalHours(seq.CvtSeqPC);
            const cvtSeqFlyTime = toDecimalHours(seq.CvtSeqFlyTime);
            const cvtTAFB = toDecimalHours(seq.CvtTAFB);
            const cvtSeqPremTime = toDecimalHours(seq.CvtSeqPremTime);

            // return res.json({ seqLegs });

            // console.log("cvtSeqPC===>>>", cvtSeqPC);
            // console.log("cvtSeqPC===>>>", cvtSeqFlyTime);
            // console.log("cvtSeqPC===>>>", cvtTAFB);
            // console.log("cvtSeqPC===>>>", cvtSeqPremTime);

            const cvtDPDeadheadTime = toDecimalHours(
                deadheadMap[seq.SeqNo] ?? 0
            );
            // const payHours = cvtSeqPC + cvtDPDeadheadTime + cvtSeqFlyTime;
            const payHours = 0
            const creditHours = cvtSeqPC + cvtSeqFlyTime;
            const tafbHours = cvtTAFB;
            const premiumHours = cvtSeqPremTime;

            const category = seq.SeqCategory?.toUpperCase() ?? "DOM";
            const premiumTranscon = seq.PremiumTranscon;

            // -------------------------
            // PER DIEM / TAFB PAY LOGIC
            // -------------------------

            let tafbPay = 0;
            let sanityLegTAFBTotal = 0;

            // CASE 1: DOM / IPD / HAW -> simple sequence-level rate
            if (category == "DOM") {
                const perDiemRate = premiumTranscon != 1 ? perDiem_dom : perDiem_int;
                tafbPay = tafbHours * perDiemRate;
            }

            else if (category == 'IPD' || category == 'HAW') {
                const perDiemRate = perDiem_int;
                tafbPay = tafbHours * perDiemRate;
            }

            // CASE 2: INT -> per-leg detailed calculation
            else if (category == "INT") {
                for (const leg of seqLegs) {
                    // console.log("seqLegs Inside the Sequence With Leg", seqLegs)
                    const CvtDPOnDutyTime = toDecimalHours(leg.CvtDPOnDutyTime);

                    console.log("CvtDP")
                    // prefer explicit layover column if available
                    // const cvtLayover = toDecimalHours(leg.CvtLayover ?? leg.CvtLayover ?? 0);
                    const cvtLayover = toDecimalHours(leg.CvtLayover ?? 0);

                    sanityLegTAFBTotal += (CvtDPOnDutyTime + cvtLayover);

                    const dep = (leg.DeptStn || "").toString().toUpperCase();
                    const arr = (leg.ArrvStn || "").toString().toUpperCase();

                    const isDepINT = airportIntl[dep] == true;
                    const isArrINT = airportIntl[arr] == true;

                    // console.log("is Dept Int", isDepINT)
                    // console.log("is Arr Int", isArrINT)
                    // Determine flight rate (if either station is INT -> INT rate, else DOM)
                    const legRate = (isDepINT || isArrINT) ? perDiem_int : perDiem_dom;

                    // console.log("Leg Rate", legRate)
                    // ---- IMPORTANT: EOD layover handling ----
                    // If EOD === 1 => apply arrival-based rate to cvtLayover.
                    // If EOD !== 1 => include layover in flightPart and pay at flightRate (no special layover pay).
                    let legPay = 0;
                    if (cvtLayover > 0 && Number(leg.EOD) == 1) {
                        // arrival-based layover rate per your rule:
                        // const layoverRate = isArrINT ? perDiem_int : perDiem_dom;
                        const layoverRate = (isDepINT || isArrINT) ? perDiem_int : perDiem_dom;
                        console.log("layoverRate", layoverRate)
                        legPay = (CvtDPOnDutyTime * legRate) + (cvtLayover * layoverRate);
                        // console.log("legPay inside EOD", legPay)
                    } else {
                        // no special layover pay: pay entire leg total at flightRate
                        legPay = (CvtDPOnDutyTime + cvtLayover) * legRate;
                        // console.log("legPay outside EOD", legPay)
                    }

                    tafbPay += legPay;
                }

                // sanity check vs seq.CvtTAFB
                if (Math.abs(sanityLegTAFBTotal) > 0.01) {
                    console.warn("TAFB sanity match for Seq:", seq.SeqNo, {
                        seqTAFB: tafbHours,
                        summedLegTAFB: sanityLegTAFBTotal,
                    });
                }
            }

            seq.tafbPay = tafbPay;

            // Boarding Pay
            let hourlyBoardingRate = 0;
            let boarding_type = 0;

            const boardingResult = await pool.request()
                .input("YearsOfService", sql.Int, yearsOfService)
                .query(`
            SELECT *
            FROM boarding_pay
            WHERE YearsOfService = @YearsOfService
            `);

            // const boardingRow = boardingResult.recordset?.[0] ?? null;

            const boardingRow = boardingResult.recordset?.[0] ?? null;

            for (const leg of leg_equip_types) {
                const dep = (leg.dep_stn || "").toString().toUpperCase();
                const arr = (leg.arr_stn || "").toString().toUpperCase();

                const isDepINT = airportIntl[dep] == true;
                const isArrINT = airportIntl[arr] == true;

                // Determine flight rate (if either station is INT -> INT rate, else DOM)
                // let SeqCategory = (isDepINT || isArrINT) ? 'INT' : 'DOM'; // if IPD use that one as INT
                // if (category == 'IPD') { SeqCategory = 'IPD' };

                let SeqCategory =
                    category == 'IPD' ? 'IPD' :
                        category == 'HAW' ? 'IPD' :
                            (isDepINT || isArrINT) ? 'INT' : 'DOM';

                // let SeqCategory =
                //     category === 'IPD' ? 'IPD' :
                //         category === 'HAW' ? 'HAW' :
                //             (isDepINT || isArrINT) ? 'INT' : 'DOM';

                // const posRow = premiumRows.find(r =>
                //     r.leg_equip_type == leg.leg_equip_type &&
                //     r.seq_catagory == SeqCategory
                // );
                // old
                // const key = `${leg.leg_equip_type}_${SeqCategory}`;
                // const posRow = premiumMap.get(key);

                // new
                const positionPremiumPay = await pool.request()
                    .input("leg", sql.Int, leg.leg_equip_type)
                    .input("category", sql.NVarChar, SeqCategory)
                    .query(`
                    SELECT *
                    FROM crew_premium_pos_count
                    WHERE leg_equip_type = @leg
                    and seq_catagory = @category
                    `);
                // FROM position_premium_rate

                const posRow = positionPremiumPay.recordset?.[0] ?? null;
                if (!posRow || !boardingRow) {
                    continue; // skip invalid rows
                }

                // const seqCat = posRow.seq_catagory;
                const seqCat = SeqCategory;
                const boardingType = Number(posRow.boarding_type); // ensure numeric comparison

                // ───────────────────────────────────────────────
                // DOMESTIC (DOM)
                // ───────────────────────────────────────────────
                if (seqCat == "DOM") {
                    if (boardingType == 35) {
                        boarding_type += parseFloat(boardingRow.boarding_35_type)
                        // hourlyBoardingRate += parseFloat(boardingRow.hourly_boarding_rate ?? 0);
                        hourlyBoardingRate += parseFloat(boardingRow.boarding_35_type ?? 0);
                    }
                    else if (boardingType == 40) {
                        // hourlyBoardingRate += parseFloat(boardingRow.hourly_boarding_rate ?? 0);
                        boarding_type += parseFloat(boardingRow.boarding_35_type)
                        hourlyBoardingRate += parseFloat(boardingRow.boarding_40_type ?? 0);
                    }
                }

                // ───────────────────────────────────────────────
                // INTERNATIONAL (INT)
                // ───────────────────────────────────────────────
                else if (seqCat == "INT") {
                    if (boardingType == 45) {
                        console.log("boardingType", boardingType)
                        console.log("SeqCat", seqCat)
                        boarding_type += parseFloat(boardingRow.boarding_45_type)
                        console.log("boarding_type", boarding_type)
                        // hourlyBoardingRate += parseFloat(boardingRo/w.hourly_boarding_rate ?? 0);
                        hourlyBoardingRate += parseFloat(boardingRow.boarding_45_type ?? 0);
                    }
                    else if (boardingType == 50) {
                        console.log("boardingType", boardingType)
                        console.log("SeqCat", seqCat)
                        boarding_type += parseFloat(boardingRow.boarding_50_type)
                        console.log("boarding_type", boarding_type)
                        // hourlyBoardingRate += parseFloat(boardingRow.hourly_boarding_rate ?? 0);
                        hourlyBoardingRate += parseFloat(boardingRow.boarding_50_type ?? 0);
                    }
                }

                // ───────────────────────────────────────────────
                // IPD / HAW
                // ───────────────────────────────────────────────
                else if (seqCat == "IPD") {
                    if (boardingType == 50) {
                        console.log("boardingType", boardingType)
                        console.log("SeqCat", seqCat)
                        boarding_type += parseFloat(boardingRow.boarding_50_type)
                        console.log("boarding_type", boarding_type)
                        // hourlyBoardingRate += parseFloat(boardingRow.hourly_boarding_rate ?? 0);
                        hourlyBoardingRate += parseFloat(boardingRow.boarding_50_type ?? 0);
                    }
                }

                else if (seqCat == "HAW") {
                    if (boardingType == 50) {
                        console.log("boardingType", boardingType)
                        console.log("SeqCat", seqCat)
                        boarding_type += parseFloat(boardingRow.boarding_50_type)
                        console.log("boarding_type", boarding_type)
                        // hourlyBoardingRate += parseFloat(boardingRow.hourly_boarding_rate ?? 0);
                        hourlyBoardingRate += parseFloat(boardingRow.boarding_50_type ?? 0);
                    }
                }

                // ───────────────────────────────────────────────
                // FALLBACK (no matching category)
                // ───────────────────────────────────────────────
                else {
                    console.log("No matching seq category for leg:", seqCat);
                }
            }
            const boardingPay = boarding_type;

            // Premium Pay
            let premiumRate = 0;
            if (category == "IPD") premiumRate = 3.75;
            else if (category == "INT" || category == "HAW") premiumRate = 3.0; // HAW = INT
            // else if (category === "SPK") premiumRate = 2.0;

            // calculate base premiums
            const payHoursDollars = payHours * baseRate;
            const creditHoursDollars = creditHours * baseRate;
            const premiumPay = premiumHours * premiumRate;

            // default speaker pay values
            let speakerPay = 0;
            let premiumWithSpeaker = premiumPay;

            // if user has languages → apply speaker pay
            // if (languages.length > 0) 
            if (languages?.length) {
                speakerPay = premiumHours * 2;

                premiumWithSpeaker += speakerPay;
            }

            let PBI = false;

            if (dayWiseLegs && dayWiseLegs.length === 1) {
                const legs = dayWiseLegs[0].legs || dayWiseLegs[0];

                if (legs.length >= 2) {
                    const firstLeg = legs[0];
                    const lastLeg = legs[legs.length - 1];

                    if (
                        firstLeg.DeptStn === lastLeg.ArrvStn &&
                        firstLeg.DeptDate === lastLeg.ArrvDate
                    ) {
                        PBI = true;
                    }
                }
            }

            const totalEarnings =
                payHoursDollars +
                creditHoursDollars +
                tafbPay +
                premiumWithSpeaker +
                boardingPay +
                extraAmount;

            // push result
            sequences.push({
                seqNo: seq.SeqNo,
                crewBase: seq.CrewBase,
                category: seq.SeqCategory,
                effDate: seq.EffDate instanceof Date ? seq.EffDate.toISOString().split("T")[0] : seq.EffDate,
                thruDate: seq.ThruDate instanceof Date ? seq.ThruDate.toISOString().split("T")[0] : seq.ThruDate,
                totalLegs: seq.NBR_Legs,
                totalDays: seq.NBR_Days,
                totalDuty: seq.NBR_Duty,
                seqCrewPos: seq.SeqCrewPos,
                slots: normalizeSeqCrewPos(seq.SeqCrewPos),
                PBI,
                payHours: decimalHoursToHHMM(payHours),
                creditHours: decimalHoursToHHMM(creditHours),
                tafb: decimalHoursToHHMM(tafbHours),
                // sitRigHours: decimalHoursToHHMM(layOverHours),
                sitRigHours: decimalHoursToHHMMSS(layOverHours),
                seqPremiumTime: decimalHoursToHHMM(premiumHours),
                effDates,
                boardingRow,
                flightDays,
                dayWiseLegs,
                earnings: {
                    sitRig: extraAmount.toFixed(2),
                    yearsOfService,
                    baseRate,
                    tafbHours,
                    tafbPay: tafbPay.toFixed(2),
                    payHoursDollars: payHoursDollars.toFixed(2),
                    creditHoursDollars: creditHoursDollars.toFixed(2),
                    premiumPay: premiumWithSpeaker.toFixed(2),
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
    }
    catch (error: any) {
        console.error("Error in searchByMonth:", error);
        console.timeEnd("SQL_TIME");
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
}

function minusOneHour(time: string): string {
    if (!time) return time;

    const [hours, minutes] = time.split(":").map(Number);

    let newHour = hours - 1;
    if (newHour < 0) newHour = 23; // handle midnight case

    return `${newHour.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
}

const formatMinutes = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    const hh = h.toString().padStart(2, "0");
    const mm = m.toString().padStart(2, "0");

    return `${hh}:${mm}`;
};


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

const decimalHoursToHHMMSS = (decimalHours: number): string => {
    const totalSeconds = Math.round(decimalHours * 3600);

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
    return seqCrewPos.split("").map(ch => ch !== "0");
};

// converts departure minutes to boarding minutes (subtracts 30min safely)
const calculateBoardingTime = (dptTime: number): number => {
    let boarding = dptTime - 30;
    if (boarding < 0) {
        boarding = 1440 + boarding; // wrap around if it goes before midnight
    }
    return boarding;
};

