import { Router } from 'express';
import {
    getProfile, getCrewBaseRanking, uploadAvatar, changePassword, sequenceWithLegs, sequence,
    filterByDate, applyPosition, basePay, updateReserve, deleteSequence,
    getStubs, get12MonthSequenceData, searchByMonth
} from '../controllers/userController';
import { authenticate } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/upload';
// import { changePassword } from '../controllers/authControllerNew';

const router = Router();

// authenticate
// router.post('/reset-password', authenticate, resetPassword);
router.post('/change-password', authenticate, changePassword);
router.get('/get-profile', authenticate, getProfile);
router.get('/get-crew-bases', authenticate, getCrewBaseRanking);
// router.get('/get-crew-bases', getCrewBaseRanking);
// router.post('/upload-avatar', authenticate, upload.single('file'), uploadAvatar);
router.post('/upload-avatar', authenticate, uploadAvatar);

// sequence or userSequence
// router.get('/sequence-calender', authenticate, sequence)
// router.get('/sequence-with-legs', authenticate, sequenceWithLegs)
router.get('/calender-sequence', authenticate, sequence)
router.get('/sequence-search', authenticate, sequenceWithLegs)
router.get('/filter-by-date', authenticate, filterByDate)
router.patch('/apply-position', authenticate, applyPosition)
router.delete('/delete-sequence', authenticate, deleteSequence)
router.get('/base-pay', authenticate, basePay)
router.patch('/update-reserve', authenticate, updateReserve);

router.get('/get-stubs/:flightNumber', getStubs);

router.get('/get-12-month-sequence-data', authenticate, get12MonthSequenceData)
router.get('/search-by-month', authenticate, searchByMonth)

export default router;
