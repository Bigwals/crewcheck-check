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

const DEBUG_DIR = path.resolve(__dirname, '../../storage/debug/cci');
const LOGIN_TIMEOUT_MS = Number(process.env.CCI_LOGIN_TIMEOUT_MS ?? 120000);
const NAV_TIMEOUT_MS = Number(process.env.CCI_NAVIGATION_TIMEOUT_MS ?? 30000);
const BROWSER_USER_AGENT = process.env.CCI_USER_AGENT ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const BROWSER_LOCALE = process.env.CCI_LOCALE ?? 'en-US';
const BROWSER_TIMEZONE = process.env.CCI_TIMEZONE ?? 'America/Los_Angeles';
const BROWSER_VIEWPORT = {
    width: Number(process.env.CCI_VIEWPORT_WIDTH ?? 1440),
    height: Number(process.env.CCI_VIEWPORT_HEIGHT ?? 900)
};
const BROWSER_STEALTH_SCRIPT = `
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
    });
    Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
    });
    Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32'
    });
    window.chrome = window.chrome || { runtime: {} };
`;

if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

const normalizeForFileName = (value: string): string =>
    value.replace(/[^a-zA-Z0-9._-]/g, '_');

const logLoginStep = (userId: string, step: string, details?: unknown): void => {
    if (details === undefined) {
        console.log(`[CCI:${userId}] ${step}`);
        return;
    }

    console.log(`[CCI:${userId}] ${step}`, details);
};

const captureLoginArtifacts = async (page: any, userId: string, label: string): Promise<void> => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basePath = path.join(DEBUG_DIR, `${userId}-${normalizeForFileName(label)}-${stamp}`);

    try {
        await page.screenshot({ path: `${basePath}.png`, fullPage: true });
        logLoginStep(userId, `Saved screenshot for ${label}`, `${basePath}.png`);
    } catch (error: any) {
        logLoginStep(userId, `Screenshot failed for ${label}`, error?.message ?? error);
    }

    try {
        fs.writeFileSync(`${basePath}.html`, await page.content(), 'utf8');
        logLoginStep(userId, `Saved HTML for ${label}`, `${basePath}.html`);
    } catch (error: any) {
        logLoginStep(userId, `HTML capture failed for ${label}`, error?.message ?? error);
    }
};

const attachLoginDiagnostics = (page: any, userId: string): void => {
    page.on('console', (msg: any) => {
        console.log(`[CCI:${userId}][console:${msg.type()}]`, msg.text());
    });

    page.on('pageerror', (error: any) => {
        console.error(`[CCI:${userId}][pageerror]`, error);
    });

    page.on('requestfailed', (request: any) => {
        console.error(`[CCI:${userId}][requestfailed]`, request.url(), request.failure()?.errorText);
    });

    page.on('framenavigated', (frame: any) => {
        if (frame === page.mainFrame()) {
            console.log(`[CCI:${userId}][navigated]`, frame.url());
        }
    });
};

const isAccessDeniedPage = async (page: any): Promise<boolean> => {
    const title = await page.title().catch(() => '');
    if (/access denied/i.test(title)) return true;

    const bodyText = await page
        .locator('body')
        .innerText()
        .catch(() => '');

    return /access denied|forbidden/i.test(bodyText);
};

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

        const context = await browser.newContext({
            storageState: authFile,
            userAgent: BROWSER_USER_AGENT,
            locale: BROWSER_LOCALE,
            timezoneId: BROWSER_TIMEZONE,
            viewport: BROWSER_VIEWPORT,
            screen: {
                width: BROWSER_VIEWPORT.width,
                height: BROWSER_VIEWPORT.height
            },
            deviceScaleFactor: 1,
            hasTouch: false,
            isMobile: false,
            colorScheme: 'light',
            javaScriptEnabled: true,
            acceptDownloads: true,
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        await context.addInitScript({ content: BROWSER_STEALTH_SCRIPT });
        return context;
    }

    // ========================
    // 2. NEW LOGIN FLOW
    // ========================
    console.log(`👉 No session found for user ${userId}`);

    const context = await browser.newContext({
        userAgent: BROWSER_USER_AGENT,
        locale: BROWSER_LOCALE,
        timezoneId: BROWSER_TIMEZONE,
        viewport: BROWSER_VIEWPORT,
        screen: {
            width: BROWSER_VIEWPORT.width,
            height: BROWSER_VIEWPORT.height
        },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        colorScheme: 'light',
        javaScriptEnabled: true,
        acceptDownloads: true,
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });
    await context.addInitScript({ content: BROWSER_STEALTH_SCRIPT });
    const page = await context.newPage();

    attachLoginDiagnostics(page, userId);

    logLoginStep(userId, 'Navigating to CCI login page');
    const response = await page.goto('https://cci.aa.com', {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT_MS
    });

    logLoginStep(userId, 'Login page loaded', {
        url: page.url(),
        title: await page.title().catch(() => ''),
        status: response?.status() ?? null
    });

    if (response?.status() === 403 || await isAccessDeniedPage(page)) {
        await captureLoginArtifacts(page, userId, 'access-denied');
        throw new Error(
            'CCI returned Access Denied (403) on the VPS. This is an upstream block or bot/WAF restriction, not a wait timeout.'
        );
    }

    await captureLoginArtifacts(page, userId, 'before-wait');

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

    try {
        logLoginStep(userId, 'Waiting for post-login redirect', {
            timeoutMs: LOGIN_TIMEOUT_MS,
            expected: ['/overview', '/calendar', '/dashboard', '/home']
        });

        await page.waitForFunction(`
            window.location.href.includes('/overview') ||
            window.location.href.includes('/calendar') ||
            window.location.href.includes('/dashboard') ||
            window.location.href.includes('/home')
        `, { timeout: LOGIN_TIMEOUT_MS });
    } catch (error: any) {
        logLoginStep(userId, 'Login wait timed out', error?.message ?? error);
        logLoginStep(userId, 'Final URL at timeout', page.url());
        await captureLoginArtifacts(page, userId, 'timeout');
        throw error;
    }

    console.log('✅ Login detected');

    await captureLoginArtifacts(page, userId, 'after-wait');

    // small delay to let cookies settle
    logLoginStep(userId, 'Waiting for auth state to settle', 5000);
    await page.waitForTimeout(5000);

    console.log('💾 Saving session...');

    await context.storageState({
        path: authFile
    });

    console.log(`✅ Session saved for user ${userId}`);

    return context;
};
