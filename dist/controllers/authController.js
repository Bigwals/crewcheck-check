"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.resendOtp = exports.login = exports.verifyOTP = exports.getLanguages = exports.register = void 0;
// import { createUser } from '../services/authService';
const authService_1 = require("../services/authService");
// import { findUserByEmail, findUserByCrewId, findUserByClientCrewId, getCrewPayDetails, findCrewOld } from '../services/userService';
const userServiceNew_1 = require("../services/userServiceNew");
const bcrypt_1 = __importDefault(require("bcrypt"));
const uuid_1 = require("uuid");
const jwt_1 = require("../utils/jwt");
const otp_1 = require("../utils/otp");
const responseMessages_1 = require("../constants/responseMessages");
const statusCodes_1 = require("../constants/statusCodes");
const mailer_1 = require("../utils/mailer");
const authValidation_1 = require("../validations/authValidation");
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const mongoose_1 = require("mongoose");
const register = async (req, res) => {
    try {
        const { airline, crewId, firstName, lastName, telephone, email, purser, speaker, languages, deviceToken,
        // commuterAirportCode,
         } = authValidation_1.registerSchema.parse(req.body);
        const existingEmail = await (0, userServiceNew_1.findCrewByEmail)(email);
        if (existingEmail) {
            return res
                .status(statusCodes_1.StatusCode.CONFLICT)
                .json({ message: responseMessages_1.Messages.EMAIL_ALREADY_EXISTS });
        }
        const existingCrew = await (0, userServiceNew_1.findByCrewId)(crewId, firstName, lastName);
        if (!existingCrew) {
            return res
                .status(statusCodes_1.StatusCode.NOT_FOUND)
                .json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        const password = (0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 10);
        const hashedPassword = await bcrypt_1.default.hash(password, Number(process.env.SALT) || 10);
        const UserID = (0, uuid_1.v4)();
        const CreatedAt = (0, mongoose_1.now)();
        const RoleID = 2;
        const ActiveStatus = true;
        const pool = await (0, db_1.getPool)();
        await pool
            .request()
            .input("UserID", db_1.sql.UniqueIdentifier, UserID)
            .input("CrewID", db_1.sql.Int, existingCrew.CrewID)
            .input("FirstName", db_1.sql.NVarChar, existingCrew.FirstName)
            .input("LastName", db_1.sql.NVarChar, existingCrew.LastName)
            .input("HireDate", db_1.sql.DateTime, existingCrew.HireDate)
            .input("OccDate", db_1.sql.DateTime, existingCrew.OccDate)
            .input("Base", db_1.sql.NVarChar, existingCrew.Base)
            .input("Seniority", db_1.sql.Int, existingCrew.Seniority)
            .input("Email", db_1.sql.NVarChar, email)
            .input("PasswordHash", db_1.sql.NVarChar, hashedPassword)
            .input("PhoneNumber", db_1.sql.NVarChar, telephone)
            .input("Airline", db_1.sql.NVarChar, airline)
            .input("Purser", db_1.sql.NVarChar, purser)
            .input("Speaker", db_1.sql.NVarChar, speaker)
            .input("RoleID", db_1.sql.Int, RoleID)
            .input("ActiveStatus", db_1.sql.Bit, ActiveStatus)
            .input("CreatedAt", db_1.sql.DateTime, CreatedAt)
            .input("DeviceToken", db_1.sql.NVarChar, deviceToken)
            .query(`
        INSERT INTO Users 
          (UserID, CrewId, FirstName, LastName, HireDate, OccDate, Base, Seniority, Airline, Email, PasswordHash, PhoneNumber, Purser, Speaker, RoleID, ActiveStatus, DeviceToken, CreatedAt)
        VALUES 
          (@UserID, @CrewId, @FirstName, @LastName, @HireDate, @OccDate, @Base, @Seniority, @Airline, @Email, @PasswordHash, @PhoneNumber, @Purser, @Speaker, @RoleID, @ActiveStatus, @DeviceToken, @CreatedAt)
      `);
        console.log("Languages from request:", languages);
        await (0, authService_1.addLanguages)(UserID, languages ?? []);
        // Send password via email
        await (0, mailer_1.sendPasswordEmail)(email, firstName, password);
        return res
            .status(statusCodes_1.StatusCode.CREATED)
            .json({ message: responseMessages_1.Messages.OTP_SENT, user: { id: UserID, email } });
    }
    catch (error) {
        console.error("Registration error:", error);
        return res
            .status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR)
            .json({
            message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR,
            error: error.message,
        });
    }
};
exports.register = register;
const getLanguages = async (req, res) => {
    try {
        const pool = await (0, db_1.getPool)();
        const result = await pool.request().query(`
    SELECT *
    FROM dbo.Language
  `);
        const languages = result.recordset;
        return res
            .status(statusCodes_1.StatusCode.CREATED)
            .json({ message: responseMessages_1.Messages.LANGUAGES_FETCHED, languages });
    }
    catch (error) {
        console.error("Registration error:", error);
        return res
            .status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR)
            .json({
            message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR,
            error: error.message,
        });
    }
};
exports.getLanguages = getLanguages;
const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        // Example dummy logic — replace with your actual verification
        const crew = await (0, userServiceNew_1.findCrewByEmail)(email);
        console.log("crew==>> ", crew);
        if (!crew || crew.otp !== otp) {
            return res.status(statusCodes_1.StatusCode.BAD_REQUEST).json({ message: responseMessages_1.Messages.INVALID_OTP_OR_EXPIRED });
        }
        await (0, otp_1.deleteOtp)(email);
        // await deviceModel.createDeviceId(savedOtp.id, deviceId, deviceType);
        // const token = generateToken({ id: crew?.id, crewId: crew?.crewId, email: crew?.email });
        // Mark crew as verified in DB here
        return res.status(statusCodes_1.StatusCode.OK).json({
            message: responseMessages_1.Messages.OTP_VERIFIED,
            crew: crew,
            // token: token,
        });
    }
    catch (error) {
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR });
    }
};
exports.verifyOTP = verifyOTP;
// old
const login = async (req, res) => {
    try {
        // const { crewId, password } = loginSchema.parse(req.body);
        const { crewId, password } = req.body;
        const crew = await (0, userServiceNew_1.findCrewById)(crewId); // crewId is string
        // const parsedCrewId = parseInt(crewId);
        // const crew = await findUserByClientCrewId(parsedCrewId);
        // return res.json({user: user});
        console.log("crew====>>>>", crew);
        if (!crewId) {
            return res.status(statusCodes_1.StatusCode.BAD_REQUEST).json({ message: responseMessages_1.Messages.INVALID_CREW_ID });
        }
        // ✅ If user exists, validate credentials
        if (crew) {
            if (!crew.PasswordHash) {
                return res.status(statusCodes_1.StatusCode.BAD_REQUEST).json({ message: responseMessages_1.Messages.PASSWORD_DOES_NOT_MATCH });
            }
            const isMatch = await bcrypt_1.default.compare(password, crew?.PasswordHash);
            if (!isMatch) {
                return res.status(statusCodes_1.StatusCode.BAD_REQUEST).json({ message: responseMessages_1.Messages.INVALID_CREDENTIALS });
            }
            // if (!crew.otpVerified) {
            //     return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.ACCOUNT_NOT_VERIFIED });
            // }
            const token = (0, jwt_1.generateToken)({ id: crew?.UserID, crewId: crew?.CrewID, email: crew?.Email, roleId: crew?.RoleID });
            return res.json({ message: "new Crew", crew, token });
        }
    }
    catch (error) {
        console.error("Login error:", error);
        // return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({
            message: "Internal Server Error",
            error: error.message,
        });
    }
};
exports.login = login;
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
const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const existing = await (0, userServiceNew_1.findCrewByEmail)(email);
        if (!existing) {
            return res.status(statusCodes_1.StatusCode.NOT_FOUND).json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        const otp = await (0, otp_1.generateOtp)();
        await (0, otp_1.saveOtp)(email, otp);
        await (0, mailer_1.sendOtpEmail)(existing.email, existing.firstName, otp);
        return res.status(statusCodes_1.StatusCode.CREATED).json({ message: responseMessages_1.Messages.OTP_SENT, otp: existing.otp });
    }
    catch (error) {
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR });
    }
};
exports.resendOtp = resendOtp;
const forgotPassword = async (req, res) => {
    try {
        const { crewId, email } = req.body;
        const existingCrew = await (0, userServiceNew_1.findCrewById)(crewId);
        if (!existingCrew) {
            return res.status(statusCodes_1.StatusCode.NOT_FOUND).json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        const password = (0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 10);
        const hashedPassword = await bcrypt_1.default.hash(password, Number(process.env.SALT) || 10);
        // await saveOtp(email, otp);
        await (0, userServiceNew_1.UpdatePassword)(crewId, hashedPassword);
        await (0, mailer_1.sendPasswordEmail)(email, existingCrew.FirstName, password);
        return res.status(statusCodes_1.StatusCode.OK).json({ message: responseMessages_1.Messages.PASSWORD_SENT });
    }
    catch (error) {
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    try {
        // const { crewId, password } = resetPasswordSchema.parse(req.body);
        const { crewId, password, confirmPassword } = req.body;
        const existing = await (0, userServiceNew_1.findCrewById)(crewId);
        if (!existing) {
            return res.status(statusCodes_1.StatusCode.NOT_FOUND).json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        if (password !== confirmPassword) {
            return res.status(statusCodes_1.StatusCode.BAD_REQUEST).json({ message: responseMessages_1.Messages.PASSWORD_DOES_NOT_MATCH });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, Number(process.env.SALT) || 10);
        existing.password = hashedPassword;
        await existing.save();
        return res.status(statusCodes_1.StatusCode.OK).json({ message: responseMessages_1.Messages.PASSWORD_CHANGED });
    }
    catch (error) {
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR });
    }
};
exports.resetPassword = resetPassword;
const formatMinutes = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
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
