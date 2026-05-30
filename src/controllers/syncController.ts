// import { Request, Response }
//     from 'express';
// import { randomInt, randomUUID } from 'crypto';

// import { syncSchedule }
//     from '../services/syncService';

// export const syncController = async (
//     req: Request,
//     res: Response
// ): Promise<void> => {

//     try {

//         // ✅ TEMP user id
//         // later from auth middleware / JWT
//         // const userId = randomUUID().replace(/-/g, "").slice(0, 5);
//         const userId = '12345';
//         // const userId = (req as any).user.id;

//         const data =
//             await syncSchedule(userId);

//         res.json({
//             success: true,
//             data
//         });

//     } catch (error: any) {

//         console.error(error);

//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

import { Request, Response } from 'express';
import { syncSchedule } from '../services/syncService';

export const syncController = async (
    req: Request,
    res: Response
): Promise<any> => {
    try {
        // ✅ Pull userId from the auth middleware, not hardcoded
        const userId = (req as any).user?.id;
        const { contractMonth } = req.query;
        // return res.json({ "contractMonth", contractMonth });

        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const data = await syncSchedule(userId, contractMonth as string);
        res.json({ success: true, data });

    } catch (error: any) {
        console.error('Sync error:', error.message);

        // Let the client know if re-auth is needed
        const needsReauth = error.message?.includes('Session was cleared');
        res.status(needsReauth ? 401 : 500).json({
            success: false,
            message: error.message,
            reauth: needsReauth ?? false
        });
    }
};