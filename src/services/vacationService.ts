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
    totalDaysOfBidMonth: number,
    totalPay: number,
) => {
    const pool = await getPool();

    const vacations = await pool.request()
        .input("UserID", sql.UniqueIdentifier, userId)
        .input("DateFrom", sql.Date, dateFrom)
        .input("DateTo", sql.Date, dateTo)
        .input("BidMonth", sql.VarChar(20), bidMonth)
        .input("TotalDaysOfBidMonth", sql.Int, totalDaysOfBidMonth)
        .input("TotalPay", sql.Decimal(12, 2), totalPay)
        .query(`
        INSERT INTO CrewVacations (
            UserID, DateFrom, DateTo, BidMonth, TotalDaysOfBidMonth, TotalPay
        )
        OUTPUT INSERTED.*
        VALUES (
            @UserID, @DateFrom, @DateTo, @BidMonth, @TotalDaysOfBidMonth, @TotalPay
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