import { Request, Response } from 'express';
// import { createUser } from '../services/authService';
import { addLanguages, updateCrew } from '../services/authService';
// import { findUserByEmail, findUserByCrewId, findUserByClientCrewId, getCrewPayDetails, findCrewOld } from '../services/userService';
import { findCrewByEmail, findByCrewId, getCrewPayDetails, findCrewById, UpdatePassword } from '../services/userServiceNew';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { generateToken } from '../utils/jwt';
import { generateOtp, saveOtp, deleteOtp } from '../utils/otp';
import { Messages } from "../constants/responseMessages";
import { StatusCode } from "../constants/statusCodes";
import { sendOtpEmail, sendPasswordEmail } from '../utils/mailer';
import { registerSchema, loginSchema, resetPasswordSchema } from '../validations/authValidation';
import { randomUUID } from 'crypto';
import { getPool, sql } from "../config/db";
import { now } from 'mongoose';

export const register = async (req: Request, res: Response): Promise<any> => {
    try {
        const {
            airline,
            crewId,
            firstName,
            lastName,
            telephone,
            email,
            purser,
            speaker,
            languages
            // commuterAirportCode,
        } = registerSchema.parse(req.body);

        const existingEmail = await findCrewByEmail(email);
        if (existingEmail) {
            return res
                .status(StatusCode.CONFLICT)
                .json({ message: Messages.EMAIL_ALREADY_EXISTS });
        }

        const existingCrew = await findByCrewId(crewId, firstName, lastName);
        if (!existingCrew) {
            return res
                .status(StatusCode.NOT_FOUND)
                .json({ message: Messages.NOT_FOUND });
        }

        const password = randomUUID().replace(/-/g, "").slice(0, 10);
        const hashedPassword = await bcrypt.hash(
            password,
            Number(process.env.SALT) || 10
        );
        const UserID = uuidv4();
        const CreatedAt = now();
        const RoleID = 2;
        const ActiveStatus = true;
        const pool = await getPool();

        await pool
            .request()
            .input("UserID", sql.UniqueIdentifier, UserID)
            .input("CrewID", sql.Int, existingCrew.CrewID)
            .input("FirstName", sql.NVarChar, existingCrew.FirstName)
            .input("LastName", sql.NVarChar, existingCrew.LastName)
            .input("HireDate", sql.DateTime, existingCrew.HireDate)
            .input("OccDate", sql.DateTime, existingCrew.OccDate)
            .input("Base", sql.NVarChar, existingCrew.Base)
            .input("Seniority", sql.Int, existingCrew.Seniority)
            .input("Email", sql.NVarChar, email)
            .input("PasswordHash", sql.NVarChar, hashedPassword)
            .input("PhoneNumber", sql.NVarChar, telephone)
            .input("Airline", sql.NVarChar, airline)
            .input("Purser", sql.NVarChar, purser)
            .input("Speaker", sql.NVarChar, speaker)
            .input("RoleID", sql.Int, RoleID)
            .input("ActiveStatus", sql.Bit, ActiveStatus)
            .input("CreatedAt", sql.DateTime, CreatedAt)
            .query(`
        INSERT INTO Users 
          (UserID, CrewId, FirstName, LastName, HireDate, OccDate, Base, Seniority, Airline, Email, PasswordHash, PhoneNumber, Purser, Speaker, RoleID, ActiveStatus, CreatedAt)
        VALUES 
          (@UserID, @CrewId, @FirstName, @LastName, @HireDate, @OccDate, @Base, @Seniority, @Airline, @Email, @PasswordHash, @PhoneNumber, @Purser, @Speaker, @RoleID, @ActiveStatus, @CreatedAt)
      `);
        console.log("Languages from request:", languages);

        await addLanguages(UserID, languages ?? []);
        // Send password via email
        await sendPasswordEmail(email, firstName, password);

        return res
            .status(StatusCode.CREATED)
            .json({ message: Messages.OTP_SENT, user: { id: UserID, email } });
    } catch (error: any) {
        console.error("Registration error:", error);
        return res
            .status(StatusCode.INTERNAL_SERVER_ERROR)
            .json({
                message: Messages.INTERNAL_SERVER_ERROR,
                error: error.message,
            });
    }
};

export const getLanguages = async (req: Request, res: Response): Promise<any> => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
    SELECT *
    FROM dbo.Language
  `);

        const languages = result.recordset;

        return res
            .status(StatusCode.CREATED)
            .json({ message: Messages.LANGUAGES_FETCHED, languages });
    } catch (error: any) {
        console.error("Registration error:", error);
        return res
            .status(StatusCode.INTERNAL_SERVER_ERROR)
            .json({
                message: Messages.INTERNAL_SERVER_ERROR,
                error: error.message,
            });
    }
}

export const verifyOTP = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, otp } = req.body;

        // Example dummy logic — replace with your actual verification
        const crew = await findCrewByEmail(email);
        console.log("crew==>> ", crew)
        if (!crew || crew.otp !== otp) {
            return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_OTP_OR_EXPIRED });
        }

        await deleteOtp(email);
        // await deviceModel.createDeviceId(savedOtp.id, deviceId, deviceType);
        // const token = generateToken({ id: crew?.id, crewId: crew?.crewId, email: crew?.email });
        // Mark crew as verified in DB here
        return res.status(StatusCode.OK).json(
            {
                message: Messages.OTP_VERIFIED,
                crew: crew,
                // token: token,
            }
        );
    } catch (error) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR });
    }
};
// old
export const login = async (req: Request, res: Response): Promise<any> => {
    try {
        // const { crewId, password } = loginSchema.parse(req.body);
        const { crewId, password } = req.body;

        const crew = await findCrewById(crewId); // crewId is string
        // const parsedCrewId = parseInt(crewId);
        // const crew = await findUserByClientCrewId(parsedCrewId);
        // return res.json({user: user});
        console.log("crew====>>>>", crew);
        if (!crewId) {
            return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREW_ID });
        }

        // ✅ If user exists, validate credentials
        if (crew) {

            if (!crew.PasswordHash) {
                return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.PASSWORD_DOES_NOT_MATCH });
            }

            const isMatch = await bcrypt.compare(password, crew?.PasswordHash);
            if (!isMatch) {
                return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREDENTIALS });
            }

            // if (!crew.otpVerified) {
            //     return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.ACCOUNT_NOT_VERIFIED });
            // }

            const token = generateToken({ id: crew?.UserID, crewId: crew?.CrewID, email: crew?.Email, roleId: crew?.RoleID });

            return res.json({ message: "new Crew", crew, token });
        }

    } catch (error: any) {
        console.error("Login error:", error);
        // return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

// new 
// export const login = async (req: Request, res: Response): Promise<any> => {
//     try {
//         const { crewId, password } = req.body;

//         if (!crewId) {
//             return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREW_ID });
//         }

//         const crew = await findCrewById(crewId);
//         if (!crew) {
//             return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREDENTIALS });
//         }

//         if (!crew.PasswordHash) {
//             return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.PASSWORD_DOES_NOT_MATCH });
//         }

//         const isMatch = await bcrypt.compare(password, crew.PasswordHash);
//         if (!isMatch) {
//             return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREDENTIALS });
//         }

//         const token = generateToken({
//             id: crew.UserID,
//             crewId: crew.CrewID,
//             email: crew.Email,
//             roleId: crew.RoleID
//         });

//         const pool = await getPool();

//         // 1) Get sequences
//         const userSeqResult = await pool.request()
//             .input("userId", sql.UniqueIdentifier, crew.UserID)
//             .query(`
//                 SELECT * 
//                 FROM dbo.UserSequence
//                 WHERE UserID = @userId
//             `);

//         const userSequences = userSeqResult.recordset;
//         if (!userSequences || userSequences.length === 0) {
//             return res.status(404).json({ message: "No sequence found for this user" });
//         }

//         const sequences: any[] = [];

//         // 2) Process each sequence
//         for (const seq of userSequences) {
//             const legsResult = await pool.request()
//                 .input("userSequenceId", sql.UniqueIdentifier, seq.UserSequenceID)
//                 .query(`
//                     SELECT *
//                     FROM dbo.UserLeg
//                     WHERE UserSequenceID = @userSequenceId
//                 `);

//             const seqLegs = legsResult.recordset || [];

//             // Totals
//             let totalPayMinutes = 0;
//             let totalCreditMinutes = 0;
//             seqLegs.forEach(l => {
//                 totalPayMinutes += (l.LegTotalFlying ?? 0) + (l.LegPC ?? 0);
//                 totalCreditMinutes += (l.LegTotalFlying ?? 0);
//             });

//             const lastArrvStn = seqLegs.length > 0 ? seqLegs[seqLegs.length - 1].ArrvStn : null;

//             const yearsOfService = 1; // Replace with logic
//             const basePayMap: Record<number, number> = {
//                 1: 35.82, 2: 37.97, 3: 40.40, 4: 43.03, 5: 47.39,
//                 6: 53.67, 7: 59.21, 8: 61.11, 9: 62.80, 10: 65.15,
//                 11: 66.94, 12: 70.12, 13: 82.24
//             };
//             const baseRate = basePayMap[yearsOfService] ?? 0;

//             const perDiemRates: Record<string, number> = { DOM: 2.5, INT: 3.75 };
//             const perDiemRate = perDiemRates[seq.SeqCategory] ?? 0;
//             const tafMinutes = seq.TAFB ?? 0;
//             const tafPerDiem = (tafMinutes / 60) * perDiemRate;

//             const flightPay = (totalPayMinutes / 60) * baseRate;
//             const creditPay = (totalCreditMinutes / 60) * baseRate;
//             const premiumPay = ((seq.SeqPremTime ?? 0) / 60) * baseRate;
//             const totalSequenceEarnings = flightPay + tafPerDiem + premiumPay;

//             sequences.push({
//                 ...seq,
//                 lastArrvStn,
//                 slots: normalizeSeqCrewPos(seq.SeqCrewPos),
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
//                     totalSequenceEarnings: totalSequenceEarnings.toFixed(2)
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
//                     layover: leg.LayoverTime ? formatMinutes(leg.LayoverTime) : null,
//                     eod: leg.EOD
//                 }))
//             });
//         }

//         // 3) Now calculate earnings summary
//         const today = new Date();
//         today.setHours(0, 0, 0, 0);

//         const totalEarnings = sequences.reduce(
//             (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings),
//             0
//         );

//         const upcomingSequences = sequences.filter(s => new Date(s.EffDate) >= today);
//         const completedSequences = sequences.filter(s => new Date(s.EffDate) < today);

//         const upcomingEarnings = upcomingSequences.reduce(
//             (sum, s) => sum + parseFloat(s.earnings.totalSequenceEarnings),
//             0
//         );

//         const earningsSummary = {
//             upcoming: upcomingEarnings,
//             total: totalEarnings,
//             display: `$${upcomingEarnings}/$${totalEarnings}`
//         };

//         return res.status(200).json({
//             message: "New Crew",
//             crew,
//             token,
//             sequences,
//             earningsSummary,
//             completedSequences,
//             upcomingSequences
//         });

//     } catch (error: any) {
//         console.error("Login error:", error);
//         return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
//             message: "Internal Server Error",
//             error: error.message,
//         });
//     }
// };

export const resendOtp = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email } = req.body;
        const existing = await findCrewByEmail(email);
        if (!existing) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND })
        }
        const otp = await generateOtp();
        await saveOtp(email, otp)
        await sendOtpEmail(existing.email, existing.firstName, otp);
        return res.status(StatusCode.CREATED).json({ message: Messages.OTP_SENT, otp: existing.otp });
    } catch (error) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR });
    }
}

export const forgotPassword = async (req: Request, res: Response): Promise<any> => {
    try {
        const { crewId, email } = req.body;
        const existingCrew = await findCrewById(crewId);

        if (!existingCrew) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

        const password = randomUUID().replace(/-/g, "").slice(0, 10);
        const hashedPassword = await bcrypt.hash(
            password,
            Number(process.env.SALT) || 10
        );
        // await saveOtp(email, otp);
        await UpdatePassword(crewId, hashedPassword)
        await sendPasswordEmail(email, existingCrew.FirstName, password)
        return res.status(StatusCode.OK).json({ message: Messages.PASSWORD_SENT });

    } catch (error: any) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
}

export const resetPassword = async (req: Request, res: Response): Promise<any> => {
    try {
        // const { crewId, password } = resetPasswordSchema.parse(req.body);
        const { crewId, password, confirmPassword } = req.body;
        const existing = await findCrewById(crewId);
        if (!existing) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }
        if (password !== confirmPassword) {
            return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.PASSWORD_DOES_NOT_MATCH });
        }
        const hashedPassword = await bcrypt.hash(password, Number(process.env.SALT) || 10);
        existing.password = hashedPassword;
        await existing.save();
        return res.status(StatusCode.OK).json({ message: Messages.PASSWORD_CHANGED });
    } catch (error) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR });
    }
}

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