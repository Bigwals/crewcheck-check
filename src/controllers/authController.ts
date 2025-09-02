import { Request, Response } from 'express';
// import { createUser } from '../services/authService';
import { updateCrew } from '../services/authService';
// import { findUserByEmail, findUserByCrewId, findUserByClientCrewId, getCrewPayDetails, findCrewOld } from '../services/userService';
import { findCrewByEmail, findByCrewId, getCrewPayDetails, findCrewAndUpdate, findCrewById, UpdatePassword } from '../services/userServiceNew';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { generateToken } from '../utils/jwt';
import { generateOtp, saveOtp, deleteOtp } from '../utils/otp';
import { Messages } from "../constants/responseMessages";
import { StatusCode } from "../constants/statusCodes";
import { sendOtpEmail, sendPasswordEmail } from '../utils/mailer';
import { registerSchema, loginSchema, resetPasswordSchema } from '../validations/authValidation';
import { OtpModel } from '../models/otpMode';
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
            .input("RoleID", sql.Int, RoleID)
            .input("ActiveStatus", sql.Bit, ActiveStatus)
            .input("CreatedAt", sql.DateTime, CreatedAt)
            .query(`
        INSERT INTO Users 
          (UserID, CrewId, FirstName, LastName, HireDate, OccDate, Base, Seniority, Email, PasswordHash, PhoneNumber, RoleID, ActiveStatus, CreatedAt)
        VALUES 
          (@UserID, @CrewId, @FirstName, @LastName, @HireDate, @OccDate, @Base, @Seniority, @Email, @PasswordHash, @PhoneNumber, @RoleID, @ActiveStatus, @CreatedAt)
      `);

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

    } catch (error) {
        console.error("Login error:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR });
    }
};

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