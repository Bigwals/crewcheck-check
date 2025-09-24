import { Request, Response } from 'express';
import { Messages } from "../constants/responseMessages";
import { StatusCode } from "../constants/statusCodes";
import { resetPasswordSchema } from '../validations/authValidation';
// import { deleteMedia, getUserProfile, uploadMedia } from '../services/authService';
import { deleteFileFromStorage, deleteMedia, updateCrewAvatar, updateCrewReverse, uploadMedia } from '../services/authService';
// import { findUserById, findUserByEmail, findUserAndUpdate } from '../services/userService';
import { findCrewById, findCrewByEmail, getCrewPayDetails, UpdatePassword, findBySequenceNo, findByDateAndSeqNo, getBoardingPayByYears, updatePosition, addSequenceDataInUserSequence, findUserAppliedSequenceNo, addLegDataInUserLeg } from '../services/userServiceNew';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { Sequence } from '../models/Sequence';
import { UserSequence } from '../models/UserSequence';
import { getPool, sql } from "../config/db";
import { findUserById } from '../services/userService';


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
        const bidMonth = req.query.bidMonth as string;  // 👈 cast to string

        if (!seqNo || isNaN(seqNo)) {
            return res.status(400).json({ message: "seqNo is required and must be numeric" });
        }

        if (!bidMonth) {
            return res.status(400).json({ message: "bidMonth is required" });
        }

        const sequenceData = await findBySequenceNo(seqNo, bidMonth);
        // return res.json({ sequenceData: sequenceData });
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
        const effDates = sequences.map(seq => dateKey(seq.effDate));

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

        // 1) Get UserSequence
        const pool = await getPool();

        // 1) Get sequences
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

        const sequences: any[] = [];

        // 2) Process each sequence
        for (const seq of userSequences) {
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

            const yearsOfService = 1; // Replace with logic
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
        
        // 3) Now calculate earnings summary
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingSequences = sequences.filter(s => new Date(s.EffDate) >= today);
        const completedSequences = sequences.filter(s => new Date(s.EffDate) < today);

        // ✅ Total = sum of all upcoming sequences
        const totalEarnings = upcomingSequences.reduce(
            (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings),
            0
        );

        // ✅ Upcoming = only next sequence (earliest by EffDate)
        let upcomingEarnings = 0;
        if (upcomingSequences.length > 0) {
            const nextSeq = upcomingSequences.sort(
                (a, b) => new Date(a.EffDate).getTime() - new Date(b.EffDate).getTime()
            )[0]; // first upcoming
            upcomingEarnings = parseFloat(nextSeq.earnings.totalSequenceEarnings);
        }

        const earningsSummary = {
            upcoming: upcomingEarnings,
            total: totalEarnings,
            display: `$${upcomingEarnings}/$${totalEarnings}`
        };

        return res.status(200).json({
            message: "User Sequence Data with User Legs",
            earningsSummary,
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
