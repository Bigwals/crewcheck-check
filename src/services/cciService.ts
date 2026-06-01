import { createAuthenticatedContext }
    from './authService';
import dotenv from 'dotenv';

dotenv.config();

import { getContextForUser, acquireUserLock, invalidateSession } from './browserService';

export const fetchSchedule = async (userId: string) => {

    const release = await acquireUserLock(userId);

    try {
        const context = await getContextForUser(userId);
        const page = await context.newPage();

        try {
            console.log(`🚀 Fetching schedule for user ${userId}`);

            await page.goto('https://cci.aa.com/calendar', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // small stabilization wait
            await page.waitForTimeout(3000);
            // ✅ FIXED: correct token extraction
            // allValues is string[], not nested — iterate directly
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

            console.log('🔑 TOKEN FOUND:', !!token);

            if (!token) {
                // Session might be stale — wipe it so next call re-authenticates
                await page.close();
                invalidateSession(userId);
                throw new Error(
                    'JWT token not found. Session was cleared — please call /sync again to re-login.'
                );
            }

            const cookies = await context.cookies([
                'https://cci.aa.com',
                'https://services.cci.aa.com'
            ]);

            const cookieHeader = cookies
                .map(({ name, value }) => `${name}=${value}`)
                .join('; ');

            const response = await fetch(
                'https://services.cci.aa.com/calendar/v4/getScheduleDetails',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, text/plain, */*',
                        'Authorization': `Bearer ${token}`,
                        ...(cookieHeader ? { Cookie: cookieHeader } : {})
                    },
                    body: JSON.stringify({})
                }
            );

            const result = {
                status: response.status,
                ok: response.ok,
                text: await response.text()
            };

            console.log('📡 STATUS:', result.status);

            return result;

        } finally {
            await page.close();
        }

    } finally {
        release(); // ✅ always release the mutex
    }
};