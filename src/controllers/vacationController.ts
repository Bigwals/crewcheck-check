import { Request, Response } from 'express';
import { Messages } from "../constants/responseMessages";
import { StatusCode } from "../constants/statusCodes";
import { resetPasswordSchema } from '../validations/authValidation';
// import { deleteMedia, getUserProfile, uploadMedia } from '../services/authService';
// import { findUserById, findUserByEmail, findUserAndUpdate } from '../services/userService';
import { getPool, sql } from "../config/db";
import {
    addCrewVacations,
    getCrewVacations,
    getCrewVacationsById,
    getCrewVacationsByMonth
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

        const pool = await getPool();

        const start = new Date(dateFrom);
        const end = new Date(dateTo);

        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        const numberOfDays =
            Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        // if (vacations) {
        //     if (numberOfDays > vacations?.TotalDaysOfBidMonth)
        //         return res.status(StatusCode.BAD_REQUEST).json({ message: "You remaining vacation are ", vacations.TotalDaysOfBidMonth, " only" });
        // }

        // let totalDaysOfBidMonth = 7;
        // totalDaysOfBidMonth -= numberOfDays;

        const service = await getCrewPayDetails(crewId);
        let pay = await getDynamicBaseRate(service.basePay.YearsOfService);

        const hoursPerDay = numberOfDays <= 6 ? 3.5 : 4;
        const totalPay = numberOfDays * hoursPerDay * pay;
        const existing = await getCrewVacationsByMonth(userId, bidMonth);
        // let result;
        // if (existing) {
        //     // UPDATE
        //     await pool.request()
        //         .input("userId", sql.UniqueIdentifier, userId)
        //         .input("bidMonth", sql.VarChar(20), bidMonth)
        //         .input("DateFrom", sql.Date, dateFrom)
        //         .input("DateTo", sql.Date, dateTo)
        //         .input("TotalPay", sql.Decimal(12, 2), totalPay)
        //         .query(`
        //             UPDATE CrewVacations
        //             SET DateFrom = @DateFrom,
        //                 DateTo = @DateTo,
        //                 TotalPay = @TotalPay,
        //                 UpdatedAt = SYSDATETIME()
        //             WHERE UserID = @userId
        //             AND BidMonth = @bidMonth
        //         `);
        // } else {
        //     // INSERT
        //    result = await addCrewVacations(userId, dateFrom, dateTo, bidMonth, totalDaysOfBidMonth, totalPay);
        // }
        // let remainingVacations = 0;

        // if (existing) {
        //     remainingVacations = totalDaysOfBidMonth - existing.NumberOfDays;
        //     // remainingVacations = existing.TotalDaysOfBidMonth - existing.NumberOfDays;

        //     if (numberOfDays > remainingVacations) {
        //         return res.status(StatusCode.BAD_REQUEST).json({
        //             message: `Your remaining vacations are "${remainingVacations}" only`
        //         });
        //     }
        // }

        // const result = await addCrewVacations(userId, dateFrom, dateTo, bidMonth, totalDaysOfBidMonth, totalPay);
        const result = await addCrewVacations(userId, dateFrom, dateTo, bidMonth, totalPay);

        return res.status(StatusCode.OK).json({ message: Messages.VACATIONS_ADDED, result })

    } catch (error: any) {
        console.error("Error in getProfile:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
}

export const updateVacations = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.id;
        const crewId = (req as any).user.crewId;

        const {
            Id,
            dateFrom,
            dateTo,
            bidMonth,
        } = req.body;

        const pool = await getPool();

        const start = new Date(dateFrom);
        const end = new Date(dateTo);

        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        const numberOfDays =
            Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // let totalDaysOfBidMonth = 7;
        // totalDaysOfBidMonth -= numberOfDays;

        const service = await getCrewPayDetails(crewId);
        let pay = await getDynamicBaseRate(service.basePay.YearsOfService);

        const hoursPerDay = numberOfDays <= 6 ? 3.5 : 4;
        const totalPay = numberOfDays * hoursPerDay * pay;
        const existing = await getCrewVacationsById(Id, bidMonth);
        // return res.json({ existing });
        let result;
        if (existing) {
            // UPDATE
            result = await pool.request()
                .input("Id", sql.Int, Id)
                .input("userId", sql.UniqueIdentifier, userId)
                .input("bidMonth", sql.VarChar(20), bidMonth)
                .input("DateFrom", sql.Date, dateFrom)
                .input("DateTo", sql.Date, dateTo)
                .input("TotalPay", sql.Decimal(12, 2), totalPay)
                .query(`
                    UPDATE CrewVacations
                    SET DateFrom = @DateFrom,
                        DateTo = @DateTo,
                        TotalPay = @TotalPay,
                        UpdatedAt = SYSDATETIME()
                    WHERE Id = @Id
                    AND BidMonth = @bidMonth
                `);
        }
        // else {
        //     // INSERT
        //    result = await addCrewVacations(userId, dateFrom, dateTo, bidMonth, totalDaysOfBidMonth, totalPay);
        // }
        // let remainingVacations = 0;

        // if (existing) {
        //     remainingVacations = totalDaysOfBidMonth - existing.NumberOfDays;
        //     // remainingVacations = existing.TotalDaysOfBidMonth - existing.NumberOfDays;

        //     if (numberOfDays > remainingVacations) {
        //         return res.status(StatusCode.BAD_REQUEST).json({
        //             message: `Your remaining vacations are "${remainingVacations}" only`
        //         });
        //     }
        // }

        // const result = await addCrewVacations(userId, dateFrom, dateTo, bidMonth, totalDaysOfBidMonth, totalPay);
        // const result = await addCrewVacations(userId, dateFrom, dateTo, bidMonth, totalPay);

        return res.status(StatusCode.OK).json({ message: Messages.VACATIONS_UPDATED, result })

    } catch (error: any) {
        console.error("Error in getProfile:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
}

export const deleteVacations = async (req: Request, res: Response): Promise<any> => {
    try {

        const {
            Id,
            bidMonth,
        } = req.body;

        const pool = await getPool();

        const existing = await getCrewVacationsById(Id, bidMonth);
        // return res.json({ existing });
        let result;
        if (existing) {
            // UPDATE
            result = await pool.request()
                .input("Id", sql.Int, Id)
                .input("bidMonth", sql.VarChar(20), bidMonth)
                .query(`
                    DELETE FROM CrewVacations
                    WHERE Id = @Id
                    AND BidMonth = @bidMonth
                `);
        }

        return res.status(StatusCode.OK).json({ message: Messages.VACATIONS_UPDATED, result })

    } catch (error: any) {
        console.error("Error in getProfile:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ message: Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
}