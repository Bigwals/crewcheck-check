import { Router } from 'express';
import {
    addStuff,
    addVacations,
    deleteVacations,
    updateStuff,
    updateVacations
} from '../controllers/vacationController';
import { authenticate } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/upload';
// import { changePassword } from '../controllers/authControllerNew';

const router = Router();

router.post('/add-vacations', authenticate, addVacations)
router.put('/update-vacations', authenticate, updateVacations)
router.delete('/delete-vacations', authenticate, deleteVacations)

// extra stuff
router.post('/add-extra-stuff', authenticate, addStuff)
router.put('/update-extra-stuff', authenticate, updateStuff)
export default router