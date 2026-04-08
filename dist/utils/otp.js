"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOtp = exports.saveOtp = exports.generateOtp = void 0;
const db_1 = require("../config/db");
// 6 digit
// export const generateOtp = async (): Promise<any> => {
//     return Math.floor(100000 + Math.random() * 900000);
// }
// 4 digit
const generateOtp = async () => {
    return Math.floor(1000 + Math.random() * 9000);
};
exports.generateOtp = generateOtp;
// export const saveOtp = async (email: string, otp: string) => {
//     const crew = await NewCrew.findOne({ email });
//     if (crew) {
//         crew.Otp = otp;
//         crew.OtpVerified = false;
//         return await crew.save();
//     }
//     return false;
// };
const saveOtp = async (email, otp) => {
    const pool = await (0, db_1.getPool)();
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
exports.saveOtp = saveOtp;
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
const deleteOtp = async (email) => {
    const pool = await (0, db_1.getPool)();
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
exports.deleteOtp = deleteOtp;
