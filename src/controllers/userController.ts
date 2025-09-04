import { Request, Response } from 'express';
import { Messages } from "../constants/responseMessages";
import { StatusCode } from "../constants/statusCodes";
import { resetPasswordSchema } from '../validations/authValidation';
// import { deleteMedia, getUserProfile, uploadMedia } from '../services/authService';
import { deleteMedia, uploadMedia } from '../services/authService';
// import { findUserById, findUserByEmail, findUserAndUpdate } from '../services/userService';
import { findCrewById, findCrewByEmail, findCrewAndUpdate, getCrewPayDetails, UpdatePassword, findBySequenceNo } from '../services/userServiceNew';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { Sequence } from '../models/Sequence';
import { UserSequence } from '../models/UserSequence';

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

export const uploadAvatar = async (req: Request, res: Response): Promise<any> => {
    try {
        const crewId = (req as any).user.id;
        const file = req.file;
        console.log("====>>>>", crewId);

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const MAX_SIZE = 2 * 1024 * 1024; // 2MB

        if (file.size > MAX_SIZE) {
            return res.status(400).json({ message: 'File is large. Max allowed size is 2MB.' });
        }
        // return res.json({ user: crewId });
        const crew = await findCrewById(crewId);

        if (!crew) {
            return res.status(StatusCode.NOT_FOUND).json({ message: Messages.NOT_FOUND });
        }

        if (crew.avatar) {
            await deleteMedia(crew?.avatar);
        }

        // const media = await uploadMedia(userId, file.filename) as { _id: string };
        const media = await uploadMedia(crewId, file.filename);
        // return res.status(200).json({media: media});
        // await findUserAndUpdate(userId, media._id.toString());
        const updatedCrew = await findCrewAndUpdate(crewId, media._id as Types.ObjectId);

        return res.status(StatusCode.OK).json({ message: Messages.AVATAR_UPLOADED, user: updatedCrew });
    } catch (error) {
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR });
    }
}

export const sequence = async (req: Request, res: Response): Promise<any> => {
    try {
        const seqNo = Number(req.query.seqNo); // Ensure it's numeric

        const data = await findBySequenceNo(seqNo);

        return res.status(200).json({
            message: "Sequence Fetched Successfully",
            sequence: data
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

        const min40Rate = 24.00;
        const min45Rate = 27.00;
        const min55Rate = 33.00;

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
            min40: min40Rate,
            min45: min45Rate,
            min55: min55Rate
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