import { createAuthenticatedContext }
    from './authService';
import dotenv from 'dotenv';

dotenv.config();

import { getContextForUser, acquireUserLock, invalidateSession } from './browserService';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const DEBUG_DIR = path.resolve(__dirname, '../../storage/debug/cci');
const NAV_TIMEOUT_MS = Number(process.env.CCI_NAVIGATION_TIMEOUT_MS ?? 30000);
const CCI_SCHEDULE_API = process.env.CCI_SCHEDULE_API ?? 'https://services.cci.aa.com/calendar/v4/getScheduleDetails';
const CCI_USER_AGENT = process.env.CCI_USER_AGENT ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

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
        await page.screenshot({ path: `${basePath}.png`, fullPage: true });
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

const getJwtExpiry = (jwt: string): number | null => {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;

    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: number };
        return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
        return null;
    }
};

const buildCookieHeader = async (context: any): Promise<string> => {
    const storageState = await context.storageState();
    const cookiePairs = (storageState.cookies || [])
        .filter((cookie: any) => {
            const domain = String(cookie.domain || '');
            return domain.includes('cci.aa.com') || domain.includes('aa.com');
        })
        .map((cookie: any) => `${cookie.name}=${cookie.value}`);

    return cookiePairs.join('; ');
};

export const fetchSchedule = async (userId: string) => {

    const release = await acquireUserLock(userId);

    try {
        const context = await getContextForUser(userId);
        const page = await context.newPage();
        attachPageDiagnostics(page, userId);

        try {
            stepLog(userId, 'Fetching schedule');

            stepLog(userId, 'Navigating to CCI calendar');
            await page.goto('https://cci.aa.com/calendar', {
                waitUntil: 'domcontentloaded',
                timeout: NAV_TIMEOUT_MS
            });
            stepLog(userId, 'Calendar page loaded', {
                url: page.url(),
                title: await page.title().catch(() => '')
            });

            // small stabilization wait
            stepLog(userId, 'Waiting for calendar to stabilize', 3000);
            await page.waitForTimeout(3000);
            // ✅ FIXED: correct token extraction
            // allValues is string[], not nested — iterate directly
            stepLog(userId, 'Extracting bearer token from storage');
            const token = await page.evaluate((): string | null => {

                const storages: Storage[] = [localStorage, sessionStorage];

                for (const storage of storages) {
                    for (let i = 0; i < storage.length; i++) {
                        const key = storage.key(i)!;
                        const value = storage.getItem(key);
                        if (!value) continue;

                        // Try parsing as JSON first
                        try {
                            const parsed = JSON.parse(value);
                            if (parsed?.access_token) return parsed.access_token;
                            if (parsed?.id_token) return parsed.id_token;

                            // Some SSO libs nest one level deep
                            for (const v of Object.values(parsed)) {
                                if (typeof v === 'object' && v !== null) {
                                    const nested = v as Record<string, unknown>;
                                    if (typeof nested.access_token === 'string') return nested.access_token;
                                    if (typeof nested.id_token === 'string') return nested.id_token;
                                }
                            }
                        } catch { /* not JSON, try raw JWT match below */ }

                        // Raw JWT pattern
                        const match = value.match(
                            /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/
                        );
                        if (match) return match[0];
                    }
                }
                return null;
            });

            stepLog(userId, 'Token extraction finished', { found: Boolean(token) });

            if (!token) {
                // Session might be stale — wipe it so next call re-authenticates
                await capturePageArtifacts(page, userId, 'missing-token');
                await page.close();
                invalidateSession(userId);
                throw new Error(
                    'JWT token not found. Session was cleared — please call /sync again to re-login.'
                );
            }

            stepLog(userId, 'Token extracted', {
                prefix: token.slice(0, 12),
                suffix: token.slice(-12)
            });

            const expiresAt = getJwtExpiry(token);
            const nowInSeconds = Math.floor(Date.now() / 1000);

            if (expiresAt && expiresAt <= nowInSeconds) {
                await capturePageArtifacts(page, userId, 'expired-token');
                await page.close();
                invalidateSession(userId);
                throw new Error('Session token expired. Session was cleared — please call /sync again to re-login.');
            }

            stepLog(userId, 'Preparing direct API request', {
                api: CCI_SCHEDULE_API,
                currentUrl: page.url()
            });

            const cookieHeader = await buildCookieHeader(context);
            stepLog(userId, 'Cookie header prepared', {
                cookieCount: cookieHeader ? cookieHeader.split('; ').length : 0
            });

            const result = await axios.post(
                CCI_SCHEDULE_API,
                {},
                {
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, text/plain, */*',
                        'Authorization': `Bearer ${token}`,
                        'Origin': 'https://cci.aa.com',
                        'Referer': 'https://cci.aa.com/calendar',
                        'User-Agent': CCI_USER_AGENT,
                        ...(cookieHeader ? { Cookie: cookieHeader } : {})
                    },
                    validateStatus: () => true
                }
            );

            const responseText = typeof result.data === 'string'
                ? result.data
                : JSON.stringify(result.data);

            stepLog(userId, 'Schedule API completed', {
                status: result.status,
                ok: result.status >= 200 && result.status < 300
            });

            if (result.status < 200 || result.status >= 300) {
                stepLog(userId, 'Schedule API body', responseText.slice(0, 500));
            }

            return {
                status: result.status,
                ok: result.status >= 200 && result.status < 300,
                text: responseText
            };

        } finally {
            await page.close();
        }

    } finally {
        release(); // ✅ always release the mutex
    }
};