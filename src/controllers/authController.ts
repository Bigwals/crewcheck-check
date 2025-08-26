import { Request, Response } from 'express';
// import { createUser } from '../services/authService';
import { updateCrew } from '../services/authService';
// import { findUserByEmail, findUserByCrewId, findUserByClientCrewId, getCrewPayDetails, findCrewOld } from '../services/userService';
import { findCrewByEmail, findCrewByCrewId, findByCrewId, getCrewPayDetails, findCrewAndUpdate, findCrewById } from '../services/userServiceNew';
import bcrypt from 'bcrypt';
import { generateToken } from '../utils/jwt';
import { generateOtp, saveOtp, deleteOtp } from '../utils/otp';
import { Messages } from "../constants/responseMessages";
import { StatusCode } from "../constants/statusCodes";
import { sendOtpEmail, sendPasswordEmail } from '../utils/mailer';
import { registerSchema, loginSchema, resetPasswordSchema } from '../validations/authValidation';
import { OtpModel } from '../models/otpMode';
import { randomUUID } from 'crypto';

export const register = async (req: Request, res: Response): Promise<any> => {
    try {
        const { airline, crewId, firstName, lastName, telephone, email, commuterAirportCode, airport, base } = registerSchema.parse(req.body);
        // const { confirmPassword } = req.body;
        // const parsedCrewId = parseInt(crewId);
        const existingEmail = await findCrewByEmail(email);
        if (existingEmail) return res.status(StatusCode.CONFLICT).json({ message: Messages.EMAIL_ALREADY_EXISTS });
        // const existingClientCrewId = await findUserByClientCrewId(parsedCrewId);
        // if (existingClientCrewId) return res.status(StatusCode.CONFLICT).json({ message: Messages.CREW_ID_ALREADY_EXISTS });
        const existingCrewId = await findCrewByCrewId(crewId);
        if (!existingCrewId) return res.status(StatusCode.CONFLICT).json({ message: Messages.NOT_FOUND });
        const password = randomUUID().replace(/-/g, "").slice(0, 10);
        // const otp = await generateOTP();
        const hashedPassword = await bcrypt.hash(password, Number(process.env.SALT) || 10);

        const crew = await updateCrew(
            airline,
            crewId,
            firstName,
            lastName,
            telephone,
            commuterAirportCode,
            // otp,
            email,
            hashedPassword,
            airport,
            base
        );

        // return res.json({ crew });
        if (crew) {
            // await sendOtpEmail(user.email, user.firstName, user.otp);
            await sendPasswordEmail(email, email, password);
            return res.status(StatusCode.CREATED).json({ message: Messages.OTP_SENT, user: { id: crew.crewId, email: crew.email } });
        }
    } catch (error: any) {
        console.error('Registration error:', error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
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

        const crew = await findCrewByCrewId(crewId); // crewId is string
        // const parsedCrewId = parseInt(crewId);
        // const crew = await findUserByClientCrewId(parsedCrewId);
        // return res.json({user: user});
        console.log("crew====>>>>", crew);
        if (!crewId) {
            return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREW_ID });
        }

        // ✅ If user exists, validate credentials
        if (crew) {
            if (!crew.password) {
                return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.PASSWORD_DOES_NOT_MATCH });
            }

            const isMatch = await bcrypt.compare(password, crew?.password);
            if (!isMatch) {
                return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREDENTIALS });
            }

            // if (!crew.otpVerified) {
            //     return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.ACCOUNT_NOT_VERIFIED });
            // }

            const token = generateToken({ id: crew?._id, crewId: crew?.crewId, email: crew?.email });
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
        const existing = await findByCrewId(crewId);

        if (!existing) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

        const otp = await generateOtp();
        await saveOtp(email, otp);
        await sendOtpEmail(existing.email, existing.firstName, existing.otp)
        return res.status(StatusCode.OK).json({ otp, message: Messages.OTP_SENT });

    } catch (error) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR });
    }
}

export const resetPassword = async (req: Request, res: Response): Promise<any> => {
    try {
        const { crewId, password } = resetPasswordSchema.parse(req.body);
        const { confirmPassword } = req.body;
        const existing = await findByCrewId(crewId);
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

// export const sendPasswordOnEmail = async (req: Request, res: Response): Promise<any> => {
//     try {
//         const { crewId, email } = req.body;

//         if (!email) {
//             return res.status(StatusCode.BAD_REQUEST).json({ message: "Email is required" });
//         }
//         // const parsedCrewId = parseInt(crewId);
//         // const existingCrewId = await findCrewOld(parsedCrewId);
//         const existingCrewId = await findCrewByCrewId(crewId);
//         if (!existingCrewId) {
//             return res.status(StatusCode.BAD_REQUEST).json({ message: Messages.INVALID_CREW_ID });
//         }
//         const otp = await generateOtp(); // e.g. 6-digit random code
//         const password = otp.toString();
//         const hashedPassword = await bcrypt.hash(password, Number(process.env.SALT) || 10)
//         const savePassword = new OtpModel({
//             crewId,
//             hashedPassword
//         })
//         await savePassword.save();
//         if (savePassword) {
//             await sendPasswordEmail(email, email, password);
//             // after send email save the email & password

//             // const crew = await findCrewAndUpdate(crewId);
//             const crew = await findCrewById(crewId);
//             if (crew) {
//                 crew.email = email;
//                 crew.password = hashedPassword;
//                 await crew.save();
//             }
//             return res.status(StatusCode.OK).json({ message: Messages.PASSWORD_SENT });
//         } else {
//             return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: "Failed to send OTP email" });
//         }
//     } catch (error) {
//         console.error("Error in sendPasswordOnEmail:", error);
//         return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR });
//     }
// }