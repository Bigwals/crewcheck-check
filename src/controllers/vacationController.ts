import { Request, Response } from 'express';
import { Messages } from "../constants/responseMessages";
import { StatusCode } from "../constants/statusCodes";
import { resetPasswordSchema } from '../validations/authValidation';
// import { deleteMedia, getUserProfile, uploadMedia } from '../services/authService';
// import { findUserById, findUserByEmail, findUserAndUpdate } from '../services/userService';
import { getPool, sql } from "../config/db";
import {
    addCrewVacations
}
    from '../services/vacationService';
import { getCrewPayDetails, getDynamicBaseRate } from '../services/userServiceNew';
import { messaging } from 'firebase-admin';

export const addVacations = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.id;
        const crewId = (req as any).user.crewId;

        const {
            dateFrom,
            dateTo,
            bidMonth,
        } = req.body;

        // const numberOfDays =
        //     Math.floor(
        //         (new Date(dateTo).getTime() - new Date(dateFrom).getTime())
        //         / (1000 * 60 * 60 * 24)
        //     ) + 1;

        const start = new Date(dateFrom);
        const end = new Date(dateTo);

        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        const numberOfDays =
            Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        let totalDaysOfBidMonth = 7;
        totalDaysOfBidMonth -= numberOfDays;

        const service = await getCrewPayDetails(crewId);
        let pay = await getDynamicBaseRate(service.basePay.YearsOfService);

        const hoursPerDay = numberOfDays <= 6 ? 3.5 : 4;
        const totalPay = numberOfDays * hoursPerDay * pay;

        const result = await addCrewVacations(userId, dateFrom, dateTo, bidMonth, totalDaysOfBidMonth, totalPay);

        return res.status(StatusCode.OK).json({ message: Messages.VACATIONS_ADDED, result })

    } catch (error: any) {
        console.error("Error in getProfile:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
}