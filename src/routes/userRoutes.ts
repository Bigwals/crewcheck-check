import { Router } from 'express';
import {
    getProfile, uploadAvatar, changePassword, sequenceWithLegs, sequence,
    filterByDate, applyPosition, basePay, updateReserve
    } from '../controllers/userController';
import { authenticate } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/upload';
// import { changePassword } from '../controllers/authControllerNew';

const router = Router();

// authenticate
// router.post('/reset-password', authenticate, resetPassword);
router.post('/change-password', authenticate, changePassword);
router.get('/get-profile', authenticate, getProfile);
router.post('/upload-avatar', authenticate, upload.single('file'), uploadAvatar);

// sequence or userSequence
router.get('/sequence', authenticate, sequence)
router.get('/sequence-with-legs', authenticate, sequenceWithLegs)
router.get('/filter-by-date', authenticate, filterByDate)
router.patch('/apply-position', authenticate, applyPosition)
router.get('/base-pay', authenticate, basePay)
router.patch('/update-reserve', authenticate, updateReserve);

export default router;
