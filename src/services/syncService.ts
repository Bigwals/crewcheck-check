// import { fetchSchedule }
// from './cciService';

// export const syncSchedule = async (
//     userId: string
// ) => {

//     const result =
//         await fetchSchedule(userId);

//     if (!result.ok) {

//         throw new Error(
//             `CCI API failed: ${result.status}`
//         );
//     }

//     let parsed;

//     try {

//         parsed = JSON.parse(result.text);

//     } catch {

//         throw new Error(
//             'Invalid JSON response'
//         );
//     }

//     console.log('✅ Schedule fetched');

//     return parsed;
// };

import { fetchSchedule } from './cciService';
import { transformScheduleData } from '../utils/transformScheduleData';

export const syncSchedule = async (userId: string) => {

    const result = await fetchSchedule(userId);

    // ✅ FIXED: result.ok is now a boolean (was the Response object before)
    if (!result.ok) {
        throw new Error(`CCI API returned HTTP ${result.status}`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(result.text);
    } catch {
        throw new Error(
            `CCI API returned non-JSON (status ${result.status}): ${result.text.slice(0, 200)}`
        );
    }

    // ✅ TRANSFORM HERE
    // const transformed = transformScheduleData(parsed);

    console.log('✅ Schedule fetched successfully');
    // return transformed;
    return parsed;
};