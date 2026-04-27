import { NewCrew } from '../models/newCrewModel';
import { BasePay } from '../models/BasePay';
import { getPool, sql } from "../config/db";
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { Types } from 'mongoose';
import { UserSequence } from '../models/UserSequence';
import * as crypto from "crypto";

dotenv.config();

export const addCrewVacations = async (
    userId: string,
    dateFrom: Date,
    dateTo: Date,
    bidMonth: string,
    // totalDaysOfBidMonth: number,
    totalPay: number,
    creditHours: string,
) => {
    const pool = await getPool();

    const vacations = await pool.request()
        .input("UserID", sql.UniqueIdentifier, userId)
        .input("DateFrom", sql.Date, dateFrom)
        .input("DateTo", sql.Date, dateTo)
        .input("BidMonth", sql.VarChar(20), bidMonth)
        // .input("TotalDaysOfBidMonth", sql.Int, totalDaysOfBidMonth)
        .input("TotalPay", sql.Decimal(12, 2), totalPay)
        .input("CreditHours", sql.VarChar(10), creditHours)
        .query(`
        INSERT INTO CrewVacations (
            UserID, DateFrom, DateTo, BidMonth, TotalPay, CreditHours
        )
        OUTPUT INSERTED.*
        VALUES (
            @UserID, @DateFrom, @DateTo, @BidMonth, @TotalPay, @CreditHours
        );
    `);

return vacations.recordset;
};

export const getCrewVacations = async (
    userId: string,
) => {
    const pool = await getPool();
    const result = await pool.request()

        .input("userId", sql.UniqueIdentifier, userId)
        .query(`
            SELECT *
            FROM CrewVacations
            WHERE UserID = @userId
        `);

    return result.recordset.length > 0 ? result.recordset : null;
}

export const getCrewExtraStuff = async (
    userId: string,
) => {
    const pool = await getPool();
    const result = await pool.request()

        .input("userId", sql.UniqueIdentifier, userId)
        .query(`
            SELECT *
            FROM CrewExtraStuff
            WHERE UserID = @userId
        `);

    return result.recordset.length > 0 ? result.recordset[0] : null;
}

export const getCrewVacationsByMonth = async (
    userId: string,
    bidMonth: string
) => {
    const pool = await getPool();

    const result = await pool.request()
        .input("userId", sql.UniqueIdentifier, userId)
        .input("bidMonth", sql.VarChar(20), bidMonth)
        .query(`
            SELECT TOP 1 *
            FROM CrewVacations
            WHERE UserID = @userId
            AND BidMonth = @bidMonth
        `);

    return result.recordset[0] || null;
};

export const getCrewVacationsById = async (
    Id: string,
    bidMonth: string,
) => {
    const pool = await getPool();

    const result = await pool.request()
        .input("Id", sql.Int, Id)
        .input("bidMonth", sql.VarChar(20), bidMonth)
        .query(`
            SELECT TOP 1 *
            FROM CrewVacations
            WHERE Id = @Id
            AND BidMonth = @bidMonth
            `);

    return result.recordset[0] || null;
};

export const addExtraStuff = async (
    userId: string,
    vacationTime: string,
    sickTime: string,
    stateCareTime: string,
    fMLA: string,
    myViewPoints: string,
) => {
    const pool = await getPool();

    const vacations = await pool.request()
        .input("UserID", sql.UniqueIdentifier, userId)
        .input("VacationTime", sql.NVarChar, vacationTime)
        .input("SickTime", sql.NVarChar, sickTime)
        .input("StateCareTime", sql.NVarChar, stateCareTime)
        .input("FMLA", sql.NVarChar, fMLA)
        .input("MyViewPoints", sql.NVarChar, myViewPoints)
        // .input("TotalDaysOfBidMonth", sql.Int, totalDaysOfBidMonth)
        .query(`
        INSERT INTO CrewExtraStuff (
            UserID, VacationTime, SickTime, StateCareTime, FMLA, MyViewPoints
        )
        OUTPUT INSERTED.*
        VALUES (
            @UserID, @VacationTime, @SickTime, @StateCareTime, @FMLA, @MyViewPoints
        );
    `);

    return vacations.recordset;
};

export const getExtraStuffById = async (
    Id: string,
) => {
    const pool = await getPool();

    const result = await pool.request()
        .input("Id", sql.Int, Id)
        .query(`
            SELECT TOP 1 *
            FROM CrewExtraStuff
            WHERE Id = @Id
            `);

    return result.recordset[0] || null;
};