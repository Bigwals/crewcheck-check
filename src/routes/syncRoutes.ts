import { Router } from 'express';

import { syncController }
    from '../controllers/syncController';
import { cciLoginController, cciStatusController } from '../controllers/authController';

import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.get('/cci-status', authenticate, cciStatusController); // check login state
router.post('/cci-login', authenticate, cciLoginController);  // first-time SSO login
router.get('/', authenticate, syncController);
// router.get('/', syncController);

export default router;


