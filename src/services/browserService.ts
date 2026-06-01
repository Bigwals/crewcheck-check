import dotenv from 'dotenv';

dotenv.config();

import { chromium, Browser, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';

// const SESSION_DIR = path.join(process.cwd(), 'storage', 'sessions');
const SESSION_DIR = path.resolve(__dirname, '../../storage/sessions');
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
console.log('📁 Session directory:', SESSION_DIR);
console.log('🪲 CCI debug directory:', DEBUG_DIR);

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

let browser: Browser | null = null;

const normalizeForFileName = (value: string): string =>
    value.replace(/[^a-zA-Z0-9._-]/g, '_');

const stepLog = (userId: string, step: string, details?: unknown): void => {
    if (details === undefined) {
        console.log(`[CCI:${userId}] ${step}`);
        return;
    }

    console.log(`[CCI:${userId}] ${step}`, details);
};

const capturePageArtifacts = async (
    page: any,
    userId: string,
    label: string
): Promise<void> => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeLabel = normalizeForFileName(label);
    const basePath = path.join(DEBUG_DIR, `${userId}-${safeLabel}-${stamp}`);

    try {
        await page.screenshot({
            path: `${basePath}.png`,
            fullPage: true
        });
        stepLog(userId, `Saved screenshot for ${label}`, `${basePath}.png`);
    } catch (error: any) {
        stepLog(userId, `Screenshot failed for ${label}`, error?.message ?? error);
    }

    try {
        const html = await page.content();
        fs.writeFileSync(`${basePath}.html`, html, 'utf8');
        stepLog(userId, `Saved HTML for ${label}`, `${basePath}.html`);
    } catch (error: any) {
        stepLog(userId, `HTML capture failed for ${label}`, error?.message ?? error);
    }
};

const attachPageDiagnostics = (page: any, userId: string): void => {
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

    page.on('response', (response: any) => {
        const status = response.status();
        if (status >= 400 || status === 302 || status === 307 || status === 308) {
            console.log(`[CCI:${userId}][response]`, status, response.url());
        }
    });

    page.on('dialog', async (dialog: any) => {
        console.log(`[CCI:${userId}][dialog]`, dialog.type(), dialog.message());
        await dialog.dismiss().catch(() => { });
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

// Per-user context pool + simple mutex (promise-based lock)
const contextPool = new Map<string, BrowserContext>();
const userLocks = new Map<string, Promise<void>>();

export const getBrowser = async (): Promise<Browser> => {
    if (!browser || !browser.isConnected()) {
        const headless = process.env.HEADLESS
            ? process.env.HEADLESS !== 'false'
            : true;

        const proxyServer = process.env.PLAYWRIGHT_PROXY_SERVER;
        const proxyUsername = process.env.PLAYWRIGHT_PROXY_USERNAME;
        const proxyPassword = process.env.PLAYWRIGHT_PROXY_PASSWORD;

        const proxy = proxyServer
            ? {
                server: proxyServer,
                ...(proxyUsername ? { username: proxyUsername } : {}),
                ...(proxyPassword ? { password: proxyPassword } : {})
            }
            : undefined;

        stepLog('system', 'Launching Chromium', {
            headless,
            proxyConfigured: Boolean(proxy),
            loginTimeoutMs: LOGIN_TIMEOUT_MS,
            navigationTimeoutMs: NAV_TIMEOUT_MS,
            userAgent: BROWSER_USER_AGENT,
            locale: BROWSER_LOCALE,
            timezone: BROWSER_TIMEZONE,
            display: process.env.DISPLAY ?? null,
            xdgRuntimeDir: process.env.XDG_RUNTIME_DIR ?? null
        });

        browser = await chromium.launch({
            headless,
            ...(proxy ? { proxy } : {}),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--lang=en-US,en'
            ]
        });
        browser.on('disconnected', () => {
            console.error('[CCI:system] Browser disconnected unexpectedly');
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
        stepLog(userId, 'Loading saved session', authFile);
        ctx = await b.newContext({
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
    } else {
        stepLog(userId, 'No session found; starting login flow');
        ctx = await b.newContext({
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

        const page = await ctx.newPage();
        attachPageDiagnostics(page, userId);

        try {
            stepLog(userId, 'Launching login page');
            const response = await page.goto('https://cci.aa.com', {
                waitUntil: 'domcontentloaded',
                timeout: NAV_TIMEOUT_MS
            });

            stepLog(userId, 'Login page loaded', {
                url: page.url(),
                title: await page.title().catch(() => ''),
                status: response?.status() ?? null
            });

            if (response?.status() === 403 || await isAccessDeniedPage(page)) {
                await capturePageArtifacts(page, userId, 'access-denied');
                throw new Error(
                    'CCI returned Access Denied (403) on the VPS. This is an upstream block or bot/WAF restriction, not a wait timeout.'
                );
            }

            await capturePageArtifacts(page, userId, 'before-wait');

            stepLog(userId, 'Waiting for post-login redirect', {
                timeoutMs: LOGIN_TIMEOUT_MS,
                expected: ['/overview', '/calendar', '/dashboard', '/home']
            });

            await page.waitForFunction(
                `
                    window.location.href.includes('/overview') ||
                    window.location.href.includes('/calendar') ||
                    window.location.href.includes('/dashboard') ||
                    window.location.href.includes('/home')
                `,
                { timeout: LOGIN_TIMEOUT_MS }
            );

            stepLog(userId, 'Post-login redirect detected', page.url());
            await capturePageArtifacts(page, userId, 'after-wait');

            stepLog(userId, 'Waiting for auth cookies/tokens to settle', 5000);
            await page.waitForTimeout(5000);

            stepLog(userId, 'Saving session state', authFile);
            await ctx.storageState({ path: authFile });
            stepLog(userId, 'Session saved');
        } catch (error: any) {
            stepLog(userId, 'Login flow failed', error?.message ?? error);
            await capturePageArtifacts(page, userId, 'timeout');
            throw error;
        } finally {
            await page.close().catch(() => { });
        }
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