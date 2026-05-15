// services/authService.ts
// import { User } from '../models/userModel';
import { NewCrew } from '../models/newCrewModel';
import { Media } from '../models/mediaModel';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Types } from "mongoose";
import { getPool, sql } from '../config/db';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

import { BrowserContext } from 'playwright';

import { getBrowser } from './browserService';

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
    const normalizedLanguageIds = Array.from(
        new Set(
            (Array.isArray(languages) ? languages : [])
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    );

    console.log("Languages to insert for user:", userId, normalizedLanguageIds);

    for (const languageId of normalizedLanguageIds) {
        const userLanguageId = uuidv4();
        const request = pool.request();

        request.input('userLanguageId', sql.UniqueIdentifier, userLanguageId);
        request.input('userId', sql.UniqueIdentifier, userId);
        request.input('languageId', sql.Int, languageId);

        const sqlQuery = `
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.UserLanguage
                WHERE UserID = @userId
                  AND LanguageID = @languageId
            )
            BEGIN
                INSERT INTO dbo.UserLanguage (UserLanguageID, UserID, LanguageID)
                VALUES (@userLanguageId, @userId, @languageId)
            END;
        `;

        try {
            await request.query(sqlQuery);
            console.log(`Inserted language ${languageId} for user ${userId}`);
        } catch (error) {
            console.error(`Error inserting language '${languageId}' for user '${userId}':`, error);
        }
    }
};

// sync data

// old
// const authFile = path.resolve(__dirname, '../storage/auth.json');

// export const createAuthenticatedContext = async () => {

//     const browser = await chromium.launch({
//         headless: false // MUST be false for first login
//     });

//     // ✅ If session exists → reuse it
//     if (fs.existsSync(authFile)) {

//         try {
//             const context = await browser.newContext({
//                 storageState: authFile
//             });

//             return context;

//         } catch (err) {

//             console.log('⚠️ Corrupted session, deleting auth file');

//             fs.unlinkSync(authFile);
//         }
//     }

//     // ❌ No session → manual login required
//     const context = await browser.newContext();
//     const page = await context.newPage();

//     await page.goto('https://cci.aa.com');

//     console.log('👉 Please login manually (including 2FA)');

//     // ✅ WAIT UNTIL USER FULLY LOGGED IN
//     await page.waitForURL(url =>
//         url.toString().includes('overview') ||
//         url.toString().includes('calendar'),
//         { timeout: 300000 }
//     );

//     console.log('✅ Login detected');

//     // ✅ SAFE FIX: wait for API trigger instead
//     await page.waitForResponse(response =>
//         response.url().includes('/calendar') &&
//         response.status() === 200,
//         { timeout: 300000 }
//     ).catch(() => {
//         console.log('⚠️ API response not needed, continuing...');
//     });

//     console.log('💾 Saving session...');

//     // 💾 SAVE SESSION
//     await context.storageState({
//         path: authFile
//     });

//     console.log('✅ Session saved successfully');

//     return context;
// };

// new

// const SESSION_DIR = path.join(process.cwd(), 'storage', 'sessions');

const SESSION_DIR = path.resolve(__dirname, '../../storage/sessions');

if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

export const createAuthenticatedContext = async (userId: string) => {

    const browser = await getBrowser();

    const authFile = path.join(
        SESSION_DIR,
        `${userId}.json`
    );

    // ========================
    // 1. USE EXISTING SESSION
    // ========================
    if (fs.existsSync(authFile)) {

        console.log(`✅ Using saved session for user ${userId}`);

        return await browser.newContext({
            storageState: authFile
        });
    }

    // ========================
    // 2. NEW LOGIN FLOW
    // ========================
    console.log(`👉 No session found for user ${userId}`);

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://cci.aa.com');

    console.log('⏳ Please complete login manually (SSO + 2FA)...');

    // ========================
    // 3. WAIT FOR REAL LOGIN
    // ========================
    // await page.waitForFunction(() => {

    //     const url = window.location.href;

    //     const isLoggedIn =
    //         url.includes('overview') ||
    //         url.includes('calendar') ||
    //         url.includes('dashboard');

    //     const hasAuthCookie =
    //         document.cookie.includes('bm_sz') ||
    //         document.cookie.includes('_abck');

    //     return isLoggedIn || hasAuthCookie;

    // }, { timeout: 300000 });

    await page.waitForFunction(`
        window.location.href.includes('/overview') ||
        window.location.href.includes('/calendar') ||
        window.location.href.includes('/dashboard') ||
        window.location.href.includes('/home')
    `, { timeout: 300000 });

    console.log('✅ Login detected');

    // small delay to let cookies settle
    await page.waitForTimeout(5000);

    console.log('💾 Saving session...');

    await context.storageState({
        path: authFile
    });

    console.log(`✅ Session saved for user ${userId}`);

    return context;
};
