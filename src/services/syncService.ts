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
import { saveScheduleInDB } from './saveScheduleToDB';

export const syncSchedule = async (userId: string, contractMonth: string) => {

    const result = await fetchSchedule(userId);

    // ✅ FIXED: result.ok is now a boolean (was the Response object before)
    if (!result.ok) {
        const snippet = result.text?.slice(0, 500)?.trim();
        throw new Error(
            snippet
                ? `CCI API returned HTTP ${result.status}: ${snippet}`
                : `CCI API returned HTTP ${result.status}`
        );
    }

    let parsed: any;
    try {
        parsed = JSON.parse(result.text);
    } catch {
        throw new Error(
            `CCI API returned non-JSON (status ${result.status}): ${result.text.slice(0, 200)}`
        );
    }

    // console.log(
    //     'PARSED RESPONSE:',
    //     JSON.stringify(parsed, null, 2)
    // );
    // ✅ TRANSFORM HERE
    const transformed = transformScheduleData(parsed, contractMonth);

    await saveScheduleInDB(
        userId,
        transformed
    );

    console.log('✅ Schedule fetched successfully');
    return transformed;
    return parsed;
};