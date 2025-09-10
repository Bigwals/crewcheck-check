import { Request, Response } from 'express';
import { Messages } from "../constants/responseMessages";
import { StatusCode } from "../constants/statusCodes";
import { resetPasswordSchema } from '../validations/authValidation';
// import { deleteMedia, getUserProfile, uploadMedia } from '../services/authService';
import { deleteFileFromStorage, deleteMedia, updateCrewAvatar, uploadMedia } from '../services/authService';
// import { findUserById, findUserByEmail, findUserAndUpdate } from '../services/userService';
import { findCrewById, findCrewByEmail, findCrewAndUpdate, getCrewPayDetails, UpdatePassword, findBySequenceNo, findByDateAndSeqNo, getBoardingPayByYears, updatePosition } from '../services/userServiceNew';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { Sequence } from '../models/Sequence';
import { UserSequence } from '../models/UserSequence';
import { getPool, sql } from "../config/db";


export const getProfile = async (req: Request, res: Response): Promise<any> => {
    try {
        // const crewId = (req as any).user.id;
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
        if (service) return res.status(200).json({ message: Messages.USER_PROFILE, crew, service });
        return res.status(200).json({ message: Messages.USER_PROFILE, crew });
    } catch (error: any) {
        console.error("Error in getProfile:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
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


// old
// export const sequenceWithLegs = async (req: Request, res: Response): Promise<any> => {
//     try {
//         const seqNo = Number(req.query.seqNo);
//         if (!seqNo || isNaN(seqNo)) {
//             return res.status(400).json({ message: "seqNo is required and must be numeric" });
//         }

//         // 1) fetch sequence rows
//         const sequenceData = await findBySequenceNo(seqNo);
//         if (!sequenceData || sequenceData.length === 0) {
//             return res.status(404).json({ message: "No sequence found for given seqNo" });
//         }

//         // 2) fetch all legs
//         const pool = await getPool();
//         const legsResult = await pool.request()
//             .input("seqNo", sql.Int, seqNo)
//             .query(`SELECT * FROM Leg WHERE SeqNo = @seqNo`);
//         const allLegs = legsResult.recordset || [];

//         // === Helper functions ===
//         const dateKey = (d: any) => {
//             if (!d) return "null";
//             const date = new Date(d);
//             return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
//         };

//         const isInternational = (station: string) => {
//             // crude check: anything not in US assumed international
//             // you may replace with real lookup table
//             const usStations = ["ORD", "DFW", "MIA", "CLT", "JFK", "LAX", "PHX", "SEA", "ATL", "BOS"];
//             return !usStations.includes(station);
//         };

//         // === Pay Rates Setup (from your basePay function) ===
//         const crewId = (req as any).user.crewId;
//         const service = await getCrewPayDetails(crewId);
//         const years = service.basePay.YearsOfService;

//         const basePayMap: Record<number, number> = {
//             1: 35.82, 2: 37.97, 3: 40.40, 4: 43.03, 5: 47.39,
//             6: 53.67, 7: 59.21, 8: 61.11, 9: 62.80, 10: 65.15,
//             11: 66.94, 12: 70.12, 13: 82.24
//         };
//         const baseRate = basePayMap[years] ?? 0;

//         const perDiems = { domestic: 2.5, international: 3.75 };
//         const premiumRates = { ipd: 3.0, nips: 2.85, speaker1: 2.0, speaker2: 3.0, speakerIpd: 3.75 };

//         const boardingPayRate = await getBoardingPayByYears(years);

//         // === Group Legs By EffDate ===
//         const groupedLegs = allLegs.reduce((acc: Record<string, any[]>, leg: any) => {
//             const k = dateKey(leg.EffDate);
//             if (!acc[k]) acc[k] = [];
//             acc[k].push({
//                 seqNo: leg.SeqNo,
//                 seqLegNo: leg.SeqLegNo,
//                 departure: leg.DeptStn,
//                 arrival: leg.ArrvStn,
//                 flightNo: leg.FitNo,
//                 dptTime: toHHmm(leg.DptTime),
//                 arvTime: toHHmm(leg.ArvTime),
//                 flyingMinutes: leg.LegTotalFlying,
//                 pc: leg.LegPC,
//                 layover: leg.Layover ? formatMinutes(leg.Layover) : null,
//                 eod: leg.EOD
//             });
//             return acc;
//         }, {});
//         Object.values(groupedLegs).forEach(arr =>
//             arr.sort((a: any, b: any) => (a.seqLegNo || 0) - (b.seqLegNo || 0))
//         );

//         // === Build Sequences with calculations ===
//         const sequences = sequenceData.map((seq: any) => {
//             const k = dateKey(seq.EffDate);
//             const legs = groupedLegs[k] || [];

//             // calc payHours, creditHours, boardings
//             const payMinutes = legs.reduce((acc, l) => acc + (l.flyingMinutes || 0) + (l.pc || 0), 0);
//             const creditMinutes = legs.reduce((acc, l) => acc + (l.flyingMinutes || 0), 0);
//             const boardings = legs.length;

//             const lastArrival = legs.find((l: any) => l.eod === 1)?.arrival || legs[legs.length - 1]?.arrival;

//             // per diem calculation: split domestic vs intl legs
//             let domesticHours = 0, intlHours = 0;
//             legs.forEach(l => {
//                 if (isInternational(l.arrival)) intlHours += (seq.TAFB / 60);
//                 else domesticHours += (seq.TAFB / 60);
//             });

//             const perDiemEarnings = (domesticHours * perDiems.domestic) + (intlHours * perDiems.international);

//             // pay earnings
//             const basePayEarnings = (payMinutes / 60) * baseRate;
//             const premiumEarnings = (seq.SeqPremTime / 60) * premiumRates.ipd;
//             const boardingEarnings = boardings * (boardingPayRate?.Boarding40Min ?? 0);

//             const totalEarnings = (
//                 basePayEarnings +
//                 premiumEarnings +
//                 boardingEarnings +
//                 perDiemEarnings
//             ).toFixed(2);

//             return {
//                 seqNo: seq.SeqNo,
//                 crewBase: seq.CrewBase,
//                 category: seq.SeqCategory,
//                 totalLegs: seq.NBR_Legs,
//                 totalDays: seq.NBR_Days,
//                 totalDuty: seq.NBR_Duty,
//                 noOfBoardings: boardings,
//                 flyTime: formatMinutes(seq.SeqFlyTime),
//                 pc: seq.SeqPC,
//                 tafb: formatMinutes(seq.TAFB),
//                 seqPremiumTime: toHHmm(seq.SeqPremTime),
//                 effDate: seq.EffDate,
//                 thruDate: seq.ThruDate,
//                 seqCrewPos: seq.SeqCrewPos,
//                 slots: normalizeSeqCrewPos(seq.SeqCrewPos),
//                 lastArrival,
//                 payHours: formatMinutes(payMinutes),
//                 creditHours: formatMinutes(creditMinutes),
//                 earnings: totalEarnings,
//                 legs
//             };
//         });

//         // separate completed vs upcoming
//         const today = new Date(); today.setHours(0, 0, 0, 0);
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
        if (!seqNo || isNaN(seqNo)) {
            return res.status(400).json({ message: "seqNo is required and must be numeric" });
        }

        // 1) Fetch all sequence rows
        const sequenceData = await findBySequenceNo(seqNo);
        if (!sequenceData || sequenceData.length === 0) {
            return res.status(404).json({ message: "No sequence found for given seqNo" });
        }

        // 2) Fetch crew service info (years of service)
        const crewId = (req as any).user?.crewId;
        const service = crewId ? await getCrewPayDetails(crewId) : null;
        const yearsOfService = service?.basePay?.YearsOfService ?? 1;

        // Base pay rates
        const basePayMap: Record<number, number> = {
            1: 35.82, 2: 37.97, 3: 40.40, 4: 43.03, 5: 47.39,
            6: 53.67, 7: 59.21, 8: 61.11, 9: 62.80, 10: 65.15,
            11: 66.94, 12: 70.12, 13: 82.24
        };
        const baseRate = basePayMap[yearsOfService] ?? 0;

        // Per diem rates
        const perDiemRates: Record<string, number> = {
            DOM: 2.5,
            INT: 3.75
        };

        // 3) Fetch all legs once
        const pool = await getPool();
        const legsResult = await pool.request()
            .input("seqNo", sql.Int, seqNo)
            .query(`SELECT * FROM Leg WHERE SeqNo = @seqNo`);
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

        // 4) Build sequences with filtered legs
        const sequences = sequenceData.map((seq: any) => {
            // Legs belonging to this sequence AND same EffDate
            const seqLegs = allLegs.filter(
                l => l.SeqNo === seq.SeqNo && dateKey(l.EffDate) === dateKey(seq.EffDate)
            );

            // Totals
            let totalPayMinutes = 0;
            let totalCreditMinutes = 0;
            seqLegs.forEach(l => {
                totalPayMinutes += (l.LegTotalFlying ?? 0) + (l.LegPC ?? 0);
                totalCreditMinutes += (l.LegTotalFlying ?? 0);
            });

            // Last arrival
            const lastArrvStn = seqLegs.length > 0 ? seqLegs[seqLegs.length - 1].ArrvStn : null;

            // Per diem
            const perDiemRate = perDiemRates[seq.SeqCategory] ?? 0;
            const tafMinutes = seq.TAFB ?? 0;
            const tafPerDiem = (tafMinutes / 60) * perDiemRate;

            // Earnings
            const flightPay = (totalPayMinutes / 60) * baseRate;
            const creditPay = (totalCreditMinutes / 60) * baseRate;
            const premiumPay = ((seq.SeqPremTime ?? 0) / 60) * baseRate;
            const totalEarnings = flightPay + tafPerDiem + premiumPay;

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
                boardings: seq.NBR_Legs,
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
                    totalEarnings: totalEarnings.toFixed(2)
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
                    layover: leg.Layover ? formatMinutes(leg.Layover) : null,
                    eod: leg.EOD
                }))
            };
        });

        // 5) Separate completed vs upcoming
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const completedSequences = sequences.filter(seq => new Date(seq.effDate) < today);
        const upcomingSequences = sequences.filter(seq => new Date(seq.effDate) >= today);

        return res.status(200).json({
            message: "Sequence(s) & legs fetched successfully",
            sequences,
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
        const seqNo = Number(req.query.seqNo);

        if (!seqNo || isNaN(seqNo)) {
            return res.status(400).json({ message: "seqNo is required and must be numeric" });
        }

        const data = await findBySequenceNo(seqNo);

        if (!data) {
            return res.status(404).json({ message: "No sequence found for given seqNo" });
        }

        // Prepare UI-ready summary
        const formatted = data.map(seq => ({
            seqNo: seq.SeqNo,
            crewBase: seq.CrewBase,
            category: seq.SeqCategory,
            totalLegs: seq.NBR_Legs,
            totalDays: seq.NBR_Days,
            totalDuty: seq.NBR_Duty,
            noOfBoardings: seq.NBR_Legs,
            // flyTime: seq.SeqFlyTime,
            flyTime: formatMinutes(seq.SeqFlyTime),
            pc: seq.SeqPC,
            tafb: formatMinutes(seq.TAFB),
            seqPremiumTime: toHHmm(seq.SeqPremTime),
            effDate: seq.EffDate,
            thruDate: seq.ThruDate,
            seqCrewPos: seq.SeqCrewPos,
            slots: normalizeSeqCrewPos(seq.SeqCrewPos),   // <-- true/false array
        }));

        return res.status(200).json({
            message: "Sequence Fetched Successfully",
            sequence: formatted
        });
    } catch (error: any) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            message: Messages.INTERNAL_SERVER_ERROR,
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

        if (!seqNo || !position) {
            return res.status(StatusCode.BAD_REQUEST).json({ message: "seqNo and position are required" });
        }

        const updatedSeqCrewPos = await updatePosition(Number(seqNo), Number(position), new Date(effDate as string));

        if (!updatedSeqCrewPos) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

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
        const speaker1Rate = 2.00;
        const speaker2Rate = 3.00;
        const speakerIpdRate = 3.75;

        const regularPayRates = {
            basePay: pay,
            rigPay: pay,
            sickPay: pay,
            vacationPay: pay,
            holidayPay: pay,
            jurydutyPay: pay,
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
            speaker1: speaker1Rate,
            speaker2: speaker2Rate,
            speakerIpd: speakerIpdRate
        }

        return res.status(200).json({ message: "Base Pay Data", service, regularPayRates, perDiems, boardingPay, premiumPay });

    } catch (error: any) {
        console.error("Error in getProfile:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
}

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
