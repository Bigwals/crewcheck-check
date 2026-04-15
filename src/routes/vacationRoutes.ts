import { Router } from 'express';
import {
    addVacations,
    deleteVacations,
    updateVacations
} from '../controllers/vacationController';
import { authenticate } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/upload';
// import { changePassword } from '../controllers/authControllerNew';

const router = Router();

router.post('/add-vacations', authenticate, addVacations)
router.put('/update-vacations', authenticate, updateVacations)
router.delete('/delete-vacations', authenticate, deleteVacations)

export default router