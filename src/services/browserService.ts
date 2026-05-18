// // browserService.ts
// import { chromium, Browser } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();
// // require("dotenv").config()

// let browser: Browser | null = null;

// export const getBrowser = async (): Promise<Browser> => {

//     if (!browser) {

//         browser = await chromium.launch({
//             headless: false,   // keep visible for debugging
//             args: ['--no-sandbox', '--disable-setuid-sandbox']
//         });

//         console.log('✅ Browser launched');
//     }

//     return browser;
// };

import { chromium, Browser, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';

// const SESSION_DIR = path.join(process.cwd(), 'storage', 'sessions');
const SESSION_DIR = path.resolve(__dirname, '../../storage/sessions');
console.log('📁 Session directory:', SESSION_DIR);

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

let browser: Browser | null = null;

// Per-user context pool + simple mutex (promise-based lock)
const contextPool = new Map<string, BrowserContext>();
const userLocks = new Map<string, Promise<void>>();

export const getBrowser = async (): Promise<Browser> => {
    if (!browser || !browser.isConnected()) {
        browser = await chromium.launch({
            // headless: process.env.HEADLESS !== 'false',

            headless: process.env.HEADLESS === 'true',   // ✅ correct — defaults to visible
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('✅ Browser launched');
    }
    return browser;
};

/**
 * Returns an isolated BrowserContext for this userId.
 * If two requests arrive for the same userId simultaneously,
 * the second waits until the first is done (mutex).
 */
export const getContextForUser = async (userId: string): Promise<BrowserContext> => {

    // Wait for any in-progress operation for this user to finish
    // if (userLocks.has(userId)) {
    //     await userLocks.get(userId);
    // }

    // Return cached context if still open
    const existing = contextPool.get(userId);
    if (existing) return existing;

    const b = await getBrowser();
    const authFile = path.join(SESSION_DIR, `${userId}.json`);

    let ctx: BrowserContext;

    if (fs.existsSync(authFile)) {
        console.log(`✅ Loading saved session for user ${userId}`);
        ctx = await b.newContext({ storageState: authFile });
    } else {
        console.log(`👉 No session for user ${userId} — starting login flow`);
        ctx = await b.newContext();

        // const page = await ctx.newPage();
        // await page.goto('https://cci.aa.com');

        // console.log('⏳ Waiting for manual SSO login...');
        // await page.waitForFunction(`
        //     window.location.href.includes('overview') ||
        //     window.location.href.includes('calendar') ||
        //     window.location.href.includes('dashboard')
        // `, { timeout: 300000 });

        // await page.waitForTimeout(3000);
        // await ctx.storageState({ path: authFile });
        // console.log(`💾 Session saved for user ${userId}`);
        // await page.close();

        const page = await ctx.newPage();
        await page.goto('https://cci.aa.com');

        console.log('⏳ Waiting for manual SSO login...');

        // ✅ Wait ONLY for post-login URLs, not cookies
        await page.waitForFunction(`
            window.location.href.includes('/overview') ||
            window.location.href.includes('/calendar') ||
            window.location.href.includes('/dashboard') ||
            window.location.href.includes('/home')
        `, { timeout: 300000 });

        // Extra wait to let all auth cookies and tokens settle
        await page.waitForTimeout(120000);

        await ctx.storageState({ path: authFile });
        console.log(`💾 Session saved for user ${userId}`);
        await page.close();
    }

    contextPool.set(userId, ctx);

    // Clean up context from pool on close
    ctx.on('close', () => {
        contextPool.delete(userId);
        console.log(`🗑️  Context removed from pool for user ${userId}`);
    });

    return ctx;
};

/**
 * Acquire a per-user mutex. Returns a release function.
 * Call release() in a finally block after your page work is done.
 */

// export const acquireUserLock = (userId: string): (() => void) => {
//     let release!: () => void;
//     const lock = new Promise<void>(res => { release = res; });
//     userLocks.set(userId, lock);
//     return () => {
//         userLocks.delete(userId);
//         release();
//     };
// };

export const acquireUserLock = async (
    userId: string
): Promise<() => void> => {

    const previous = userLocks.get(userId) || Promise.resolve();

    let release!: () => void;

    const current = new Promise<void>((resolve) => {
        release = resolve;
    });

    userLocks.set(userId, previous.then(() => current));

    await previous;

    return () => {
        release();

        if (userLocks.get(userId) === current) {
            userLocks.delete(userId);
        }
    };
};

export const invalidateSession = (userId: string): void => {
    const authFile = path.join(SESSION_DIR, `${userId}.json`);
    if (fs.existsSync(authFile)) fs.unlinkSync(authFile);
    contextPool.get(userId)?.close().catch(() => { });
    contextPool.delete(userId);
    console.log(`🔄 Session invalidated for user ${userId}`);
};