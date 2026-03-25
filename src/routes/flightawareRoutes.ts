import { Router } from 'express';
import {
    // handleFlightAwareWebhook,
     getStubs
    // updateDailyFlights
} from '../controllers/flightawareController';
import { authenticate } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/upload';
// import { changePassword } from '../controllers/authControllerNew';

const router = Router();

// router.post('webhook', handleFlightAwareWebhook);
router.get('/get-stubs', getStubs);
// router.get('/get-stubs', updateDailyFlights);

export default router;
