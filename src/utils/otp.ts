import { NewCrew } from '../models/newCrewModel';
import { User } from '../models/userModel';
import { getPool, sql } from "../config/db";

export const generateOtp = async (): Promise<any> => {
    return Math.floor(100000 + Math.random() * 900000);
}

// export const saveOtp = async (email: string, otp: string) => {
//     const crew = await NewCrew.findOne({ email });
//     if (crew) {
//         crew.Otp = otp;
//         crew.OtpVerified = false;
//         return await crew.save();
//     }
//     return false;
// };

export const saveOtp = async (email: string, otp: string) => {
    const pool = await getPool();

    // Update OTP
    const updateResult = await pool
        .request()
        .input("email", email)
        .input("Otp", otp)
        .query(`
      UPDATE Users
      SET 
        Otp = @Otp,
        OtpVerified = 0
      WHERE email = @email;
    `);

    if (updateResult.rowsAffected[0] === 0) {
        return false; // user not found
    }

    // Return updated user
    const fetchResult = await pool
        .request()
        .input("email", email)
        .query(`
      SELECT * 
      FROM Users
      WHERE email = @email;
    `);

    return fetchResult.recordset[0];
};

// export const deleteOtp = async (email: string) => {
//     const crew = await NewCrew.findOne({ email });
//     if (crew) {
//         console.log("crew data");
//         crew.Otp = '0';
//         crew.OtpVerified = true;
//         return await crew.save();
//     }
//     return false;
// };

export const deleteOtp = async (email: string) => {
    const pool = await getPool();

    // Update OTP
    const updateResult = await pool
        .request()
        .input("email", email)
        .query(`
      UPDATE Users
      SET 
        Otp = '0',
        OtpVerified = 1
      WHERE email = @email;
    `);

    if (updateResult.rowsAffected[0] === 0) {
        return false; // user not found
    }

    // Return updated user
    const fetchResult = await pool
        .request()
        .input("email", email)
        .query(`
      SELECT * 
      FROM Users
      WHERE email = @email;
    `);

    return fetchResult.recordset[0];
};
