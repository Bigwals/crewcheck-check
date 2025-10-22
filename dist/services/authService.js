"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLanguages = exports.deleteFileFromStorage = exports.updateCrewReverse = exports.updateCrewAvatar = exports.deleteMedia = exports.uploadMedia = exports.updateCrew = void 0;
// services/authService.ts
// import { User } from '../models/userModel';
const newCrewModel_1 = require("../models/newCrewModel");
const mediaModel_1 = require("../models/mediaModel");
const uuid_1 = require("uuid");
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("../config/db");
dotenv_1.default.config();
// authservice.ts
const updateCrew = async (airline, crewId, firstName, lastName, telephone, commuterAirportCode, 
// otp: string,
email, password, airport, base) => {
    // Check if the crew exists first
    const crewExists = await newCrewModel_1.NewCrew.findOne({ crewId });
    if (!crewExists) {
        return null; // Or throw an error if you prefer
    }
    // Update the crew record
    const updatedCrew = await newCrewModel_1.NewCrew.findOneAndUpdate({ crewId }, // condition
    {
        $set: {
            airline,
            firstName,
            lastName,
            telephone,
            commuterAirportCode,
            // otp,
            otpVerified: false,
            isActive: false,
            email,
            password,
            airport,
            base,
        },
    }, { new: true } // return updated doc
    );
    return updatedCrew;
};
exports.updateCrew = updateCrew;
// export const getUserProfile = async (id: string) => {
//     const crew = await NewCrew.findById(id)
//         .populate({
//             path: 'avatar',
//             select: '_id media',
//         })
//         .lean();
//     if (!crew) throw new Error('Crew not found');
//     return crew;
// };
const uploadMedia = async (crewId, media) => {
    const avatar = new mediaModel_1.Media({
        crewId,
        media
    });
    return await avatar.save();
};
exports.uploadMedia = uploadMedia;
const deleteMedia = async (id) => {
    const avatar = await mediaModel_1.Media.findByIdAndDelete(id);
    return avatar;
};
exports.deleteMedia = deleteMedia;
const updateCrewAvatar = async (crewId, ImageUrl) => {
    const pool = await (0, db_1.getPool)();
    await pool.request()
        .input("crewId", db_1.sql.Int, crewId)
        .input("ImageUrl", db_1.sql.NVarChar, ImageUrl)
        .query(`
            UPDATE Users 
            SET ImageUrl = @ImageUrl 
            WHERE crewId = @crewId
        `);
    // Return updated record
    const result = await pool.request()
        .input("crewId", db_1.sql.Int, crewId)
        .query(`SELECT crewId, FirstName, LastName, Email, ImageUrl FROM Users WHERE crewId = @crewId`);
    return result.recordset[0];
};
exports.updateCrewAvatar = updateCrewAvatar;
const updateCrewReverse = async (crewId, IsReserve) => {
    const pool = await (0, db_1.getPool)();
    await pool.request()
        .input("crewId", db_1.sql.Int, crewId)
        .input("IsReserve", db_1.sql.NVarChar, IsReserve)
        .query(`
            UPDATE Users 
            SET IsReserve = @IsReserve 
            WHERE crewId = @crewId
        `);
    // Return updated record
    const result = await pool.request()
        .input("crewId", db_1.sql.Int, crewId)
        .query(`SELECT crewId, FirstName, LastName, Email, ImageUrl, IsReserve FROM Users WHERE crewId = @crewId`);
    return result.recordset[0];
};
exports.updateCrewReverse = updateCrewReverse;
// Simulated file deletion (local or cloud)
const deleteFileFromStorage = async (filename) => {
    // Example: fs.unlinkSync(path.join(__dirname, "../uploads", filename));
    console.log("Deleted old file:", filename);
};
exports.deleteFileFromStorage = deleteFileFromStorage;
const addLanguages = async (userId, languages) => {
    const pool = await (0, db_1.getPool)();
    console.log("Languages to insert for user:", userId, languages);
    for (const languageId of languages) {
        const userLanguageId = (0, uuid_1.v4)();
        const request = pool.request();
        request.input('userLanguageId', db_1.sql.UniqueIdentifier, userLanguageId);
        request.input('userId', db_1.sql.UniqueIdentifier, userId);
        request.input('languageId', db_1.sql.Int, languageId);
        const sqlQuery = `
            INSERT INTO dbo.UserLanguage (UserLanguageID, UserID, LanguageID)
            VALUES (@userLanguageId, @userId, @languageId);
        `;
        try {
            await request.query(sqlQuery);
            console.log(`Inserted language ${languageId} for user ${userId}`);
        }
        catch (error) {
            console.error(`Error inserting language '${languageId}' for user '${userId}':`, error);
        }
    }
};
exports.addLanguages = addLanguages;
