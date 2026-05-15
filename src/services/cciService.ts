import { createAuthenticatedContext }
    from './authService';
import dotenv from 'dotenv';

dotenv.config();

// export const fetchSchedule = async () => {

//     const context = await createAuthenticatedContext();

//     const page = await context.newPage();

//     try {

//         // Open app first so storage becomes available
//         await page.goto('https://cci.aa.com/calendar');

//         console.log('🚀 Extracting JWT token...');

//         const token = await page.evaluate(() => {

//             const allValues = [
//                 ...Object.values(localStorage),
//                 ...Object.values(sessionStorage)
//             ];

//             for (const value of allValues) {

//                 if (typeof value !== 'string') {
//                     continue;
//                 }

//                 // Match JWT
//                 const match = value.match(
//                     /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/
//                 );

//                 if (match) {
//                     return match[0];
//                 }
//             }

//             return null;
//         });

//         console.log('🔑 TOKEN FOUND:', !!token);

//         if (!token) {
//             throw new Error('JWT token not found');
//         }

//         console.log('🚀 Fetching schedule...');

//         const response = await context.request.post(
//             process.env.CCI_SCHEDULE_API as string,
//             {
//                 headers: {
//                     'content-type': 'application/json',
//                     'accept': 'application/json',
//                     'authorization': `Bearer ${token}`
//                 },
//                 data: {}
//             }
//         );

//         const text = await response.text();

//         console.log('✅ API STATUS:', response.status());

//         console.log('🔥 RAW API RESPONSE:');
//         console.log(text);

//         return {
//             status: response.status(),
//             ok: response.ok(),
//             text
//         };

//     } catch (error) {

//         console.error('❌ Fetch failed:', error);

//         throw error;

//     } finally {

//         await page.close();
//     }
// };

// recent
// export const fetchSchedule = async (userId: string) => {

//     const context =
//         await createAuthenticatedContext(userId);

//     try {

//         console.log(`🚀 Fetching schedule for user ${userId}`);

//         const apiUrl = process.env.CCI_SCHEDULE_API as string;

//         // ======================================================
//         // 1️⃣ PRIMARY REQUEST (COOKIE-BASED)
//         // ======================================================
//         const response = await context.request.post(apiUrl, {
//             headers: {
//                 'content-type': 'application/json',
//                 'accept': 'application/json, text/plain, */*'
//             },
//             data: {}
//         });

//         const text = await response.text();

//         console.log('📡 PRIMARY STATUS:', response.status());
//         console.log('🔥 PRIMARY RESPONSE:', text);

//         // ======================================================
//         // 2️⃣ IF SUCCESS → RETURN
//         // ======================================================
//         if (response.ok()) {

//             return {
//                 status: response.status(),
//                 ok: true,
//                 text
//             };
//         }

//         // ======================================================
//         // 3️⃣ JWT FALLBACK (ONLY IF REQUIRED)
//         // ======================================================
//         const needsJwt =
//             response.status() === 401 &&
//             text.includes('JWT');

//         if (!needsJwt) {

//             return {
//                 status: response.status(),
//                 ok: false,
//                 text
//             };
//         }

//         console.log('⚠️ JWT required, extracting token...');

//         // ======================================================
//         // 4️⃣ SAFE TOKEN EXTRACTION (NO page.goto dependency)
//         // ======================================================
//         const page = await context.newPage();

//         console.log('⚠️ JWT missing from storage, refreshing session...');

//         await page.goto('https://cci.aa.com/overview', {
//             waitUntil: 'networkidle'
//         });

//         await page.waitForTimeout(3000);

//         const token = await page.evaluate(() => {

//             const sources = [
//                 localStorage,
//                 sessionStorage
//             ];

//             for (const store of sources) {

//                 for (const value of Object.values(store)) {

//                     if (typeof value !== 'string') continue;

//                     try {
//                         const parsed = JSON.parse(value);

//                         if (parsed?.access_token) return parsed.access_token;
//                         if (parsed?.id_token) return parsed.id_token;

//                     } catch { }
//                 }
//             }

//             return null;
//         });

//         await page.close().catch(() => { });

//         console.log('🔑 TOKEN FOUND:', !!token);

//         if (!token) {
//             throw new Error('JWT token not found in session');
//         }

//         // ======================================================
//         // 5️⃣ RETRY WITH JWT
//         // ======================================================
//         const retry = await context.request.post(apiUrl, {
//             headers: {
//                 'content-type': 'application/json',
//                 'accept': 'application/json, text/plain, */*',
//                 'authorization': `Bearer ${token}`
//             },
//             data: {}
//         });

//         const retryText = await retry.text();

//         console.log('📡 RETRY STATUS:', retry.status());
//         console.log('🔥 RETRY RESPONSE:', retryText);

//         return {
//             status: retry.status(),
//             ok: retry.ok(),
//             text: retryText
//         };

//     } catch (error) {

//         console.error('❌ fetchSchedule error:', error);
//         throw error;

//     }
// };

// old 
// export const fetchSchedule = async (userId: string) => {

//     const context = await createAuthenticatedContext(userId);
//     const page = await context.newPage();

//     try {

//         console.log(`🚀 Fetching schedule for user ${userId}`);

//         await page.goto('https://cci.aa.com/calendar');

//         const token = await page.evaluate(() => {

//             const allValues = [
//                 ...Object.values(localStorage),
//                 ...Object.values(sessionStorage)
//             ];

//             for (const store of allValues) {
//                 for (const value of Object.values(store)) {

//                     if (typeof value !== 'string') continue;

//                     try {
//                         const parsed = JSON.parse(value);

//                         if (parsed?.access_token) return parsed.access_token;
//                         if (parsed?.id_token) return parsed.id_token;

//                     } catch { }
//                 }

//                 if (typeof store !== 'string') {
//                     continue;
//                 }

//                 // Match JWT
//                 const match = store.match(
//                     /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/
//                 );

//                 if (match) {
//                     return match[0];
//                 }
//             }

//             return null;
//         });

//         console.log('🔑 TOKEN FOUND:', !!token);

//         if (!token) {
//             throw new Error('JWT token not found');
//         }

//         const result = await page.evaluate(async () => {

//             const response = await fetch(
//                 'https://services.cci.aa.com/calendar/v4/getScheduleDetails',
//                 {
//                     method: 'POST',
//                     credentials: 'include',
//                     headers: {
//                         'content-type': 'application/json',
//                         'accept': 'application/json, text/plain, */*'
//                     },
//                     body: JSON.stringify({})
//                 }
//             );

//             return {
//                 status: response.status,
//                 text: await response.text(),
//                 ok: response,
//             };
//         });

//         console.log('📡 STATUS:', result.status);
//         console.log('🔥 RESPONSE:', result.text);

//         return result;

//     } finally {
//         await page.close();
//     }
// };

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

            // ✅ Use the token in the Authorization header too (belt + suspenders)
            const result = await page.evaluate(async (jwt: string) => {
                const response = await fetch(
                    'https://services.cci.aa.com/calendar/v4/getScheduleDetails',
                    {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json, text/plain, */*',
                            'Authorization': `Bearer ${jwt}`
                        },
                        body: JSON.stringify({})
                    }
                );
                
                return {
                    status: response.status,
                    ok: response.ok,      // ✅ boolean, not the Response object
                    text: await response.text()
                };
            }, token);

            console.log('📡 STATUS:', result.status);

            return result;

        } finally {
            await page.close();
        }

    } finally {
        release(); // ✅ always release the mutex
    }
};

// import { getContextForUser, acquireUserLock, invalidateSession } from './browserService';
// import { getCachedToken, setCachedToken, clearCachedToken } from './tokenCache';

// const CCI_SCHEDULE_API = 'https://services.cci.aa.com/calendar/v4/getScheduleDetails';

// export const fetchSchedule = async (userId: string) => {

//     const release = acquireUserLock(userId);

//     try {
//         // ✅ Use cached token if still valid — skip browser entirely
//         let token = getCachedToken(userId);

//         if (!token) {
//             console.log(`🔑 No cached token for ${userId} — fetching from browser`);
//             token = await extractTokenFromBrowser(userId);
//             console.log(`⚡ token for ${token}`);
//         } else {
//             console.log(`⚡ Using cached token for ${userId}`);
//         }

//         // ✅ Call CCI API directly — no browser needed
//         const response = await fetch(CCI_SCHEDULE_API, {
//             method: 'POST',
//             credentials: 'include',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Accept': 'application/json',
//                 'Authorization': `Bearer ${token}`
//             },
//             body: JSON.stringify({})
//         });

//         // Token expired — clear cache and session, ask user to re-login
//         if (response.status === 401) {
//             clearCachedToken(userId);
//             invalidateSession(userId);
//             return {
//                 ok: false,
//                 status: 401,
//                 text: 'Session expired',
//                 reauth: true
//             };
//         }

//         return {
//             ok: response.ok,
//             status: response.status,
//             text: await response.text(),
//             reauth: false
//         };

//     } finally {
//         release();
//     }
// };

// // ─────────────────────────────────────────────────
// // Only called when no cached token exists
// // Opens a page, grabs the token, caches it, closes
// // ─────────────────────────────────────────────────
// const extractTokenFromBrowser = async (userId: string): Promise<string> => {

//     const context = await getContextForUser(userId);
//     const page = await context.newPage();

//     try {
//         await page.goto('https://cci.aa.com/calendar', {
//             waitUntil: 'networkidle',
//             timeout: 30000
//         });

//         const token = await page.evaluate((): string | null => {
//             const storages: Storage[] = [localStorage, sessionStorage];
//             for (const storage of storages) {
//                 for (let i = 0; i < storage.length; i++) {
//                     const key = storage.key(i)!;
//                     const value = storage.getItem(key);
//                     if (!value) continue;
//                     try {
//                         const parsed = JSON.parse(value);
//                         if (parsed?.access_token) return parsed.access_token;
//                         if (parsed?.id_token) return parsed.id_token;
//                         for (const v of Object.values(parsed)) {
//                             if (typeof v === 'object' && v !== null) {
//                                 const nested = v as Record<string, unknown>;
//                                 if (typeof nested.access_token === 'string') return nested.access_token;
//                                 if (typeof nested.id_token === 'string') return nested.id_token;
//                             }
//                         }
//                     } catch { }
//                     const match = value.match(
//                         /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/
//                     );
//                     if (match) return match[0];
//                 }
//             }
//             return null;
//         });

//         if (!token) {
//             invalidateSession(userId);
//             throw new Error('JWT not found after navigation. Session cleared — please re-login.');
//         }

//         // Cache for 25 minutes (CCI tokens are typically 30min)
//         setCachedToken(userId, token, 25);
//         console.log(`✅ Token extracted and cached for user ${userId}`);

//         return token;

//     } finally {
//         await page.close();
//     }
// };