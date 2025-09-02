"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.resendOtp = exports.login = exports.verifyOTP = exports.register = void 0;
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
        const { airline, crewId, firstName, lastName, telephone, email,
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
            .input("RoleID", db_1.sql.Int, RoleID)
            .input("ActiveStatus", db_1.sql.Bit, ActiveStatus)
            .input("CreatedAt", db_1.sql.DateTime, CreatedAt)
            .query(`
        INSERT INTO Users 
          (UserID, CrewId, FirstName, LastName, HireDate, OccDate, Base, Seniority, Email, PasswordHash, PhoneNumber, RoleID, ActiveStatus, CreatedAt)
        VALUES 
          (@UserID, @CrewId, @FirstName, @LastName, @HireDate, @OccDate, @Base, @Seniority, @Email, @PasswordHash, @PhoneNumber, @RoleID, @ActiveStatus, @CreatedAt)
      `);
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
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR });
    }
};
exports.login = login;
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
