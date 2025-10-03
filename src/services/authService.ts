// services/authService.ts
// import { User } from '../models/userModel';
import { NewCrew } from '../models/newCrewModel';
import { Media } from '../models/mediaModel';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { Types } from "mongoose";
import { getPool, sql } from '../config/db';

dotenv.config();

// authservice.ts
export const updateCrew = async (
    airline: string,
    crewId: number,
    firstName: string,
    lastName: string,
    telephone: string,
    commuterAirportCode: string,
    // otp: string,
    email: string,
    password: string,
    airport: string,
    base: string,
) => {
    // Check if the crew exists first
    const crewExists = await NewCrew.findOne({ crewId });
    if (!crewExists) {
        return null; // Or throw an error if you prefer
    }

    // Update the crew record
    const updatedCrew = await NewCrew.findOneAndUpdate(
        { crewId }, // condition
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
        },
        { new: true } // return updated doc
    );

    return updatedCrew;
};

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

export const uploadMedia = async (
    crewId: string,
    media: string
) => {
    const avatar = new Media({
        crewId,
        media
    })
    return await avatar.save();
}

export const deleteMedia = async (id: Types.ObjectId) => {
    const avatar = await Media.findByIdAndDelete(id);
    return avatar;
};

export const updateCrewAvatar = async (crewId: number, ImageUrl: string) => {
    const pool = await getPool();
    await pool.request()
        .input("crewId", sql.Int, crewId)
        .input("ImageUrl", sql.NVarChar, ImageUrl)
        .query(`
            UPDATE Users 
            SET ImageUrl = @ImageUrl 
            WHERE crewId = @crewId
        `);

    // Return updated record
    const result = await pool.request()
        .input("crewId", sql.Int, crewId)
        .query(`SELECT crewId, FirstName, LastName, Email, ImageUrl FROM Users WHERE crewId = @crewId`);

    return result.recordset[0];
};

export const updateCrewReverse = async (crewId: number, IsReserve: string) => {
    const pool = await getPool();
    await pool.request()
        .input("crewId", sql.Int, crewId)
        .input("IsReserve", sql.NVarChar, IsReserve)
        .query(`
            UPDATE Users 
            SET IsReserve = @IsReserve 
            WHERE crewId = @crewId
        `);

    // Return updated record
    const result = await pool.request()
        .input("crewId", sql.Int, crewId)
        .query(`SELECT crewId, FirstName, LastName, Email, ImageUrl, IsReserve FROM Users WHERE crewId = @crewId`);

    return result.recordset[0];
};

// Simulated file deletion (local or cloud)
export const deleteFileFromStorage = async (filename: string) => {
    // Example: fs.unlinkSync(path.join(__dirname, "../uploads", filename));
    console.log("Deleted old file:", filename);
};

export const addLanguages = async (userId: string, languages: number[]) => {
    const pool = await getPool();
    console.log("Languages to insert for user:", userId, languages);

    for (const languageId of languages) {
        const userLanguageId = uuidv4();
        const request = pool.request();

        request.input('userLanguageId', sql.UniqueIdentifier, userLanguageId);
        request.input('userId', sql.UniqueIdentifier, userId);
        request.input('languageId', sql.Int, languageId);

        const sqlQuery = `
            INSERT INTO dbo.UserLanguage (UserLanguageID, UserID, LanguageID)
            VALUES (@userLanguageId, @userId, @languageId);
        `;

        try {
            await request.query(sqlQuery);
            console.log(`Inserted language ${languageId} for user ${userId}`);
        } catch (error) {
            console.error(`Error inserting language '${languageId}' for user '${userId}':`, error);
        }
    }
};