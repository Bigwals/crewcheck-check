import { Router } from 'express';
import {
    addVacations
} from '../controllers/vacationController';
import { authenticate } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/upload';
// import { changePassword } from '../controllers/authControllerNew';

const router = Router();

router.post('/add-vacations', authenticate, addVacations)

export default router