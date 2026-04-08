"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
// import { changePassword } from '../controllers/authControllerNew';
const router = (0, express_1.Router)();
// authenticate
// router.post('/reset-password', authenticate, resetPassword);
router.post('/change-password', authMiddleware_1.authenticate, userController_1.changePassword);
router.get('/get-profile', authMiddleware_1.authenticate, userController_1.getProfile);
router.get('/get-crew-bases', authMiddleware_1.authenticate, userController_1.getCrewBaseRanking);
// router.get('/get-crew-bases', getCrewBaseRanking);
// router.post('/upload-avatar', authenticate, upload.single('file'), uploadAvatar);
router.post('/upload-avatar', authMiddleware_1.authenticate, userController_1.uploadAvatar);
router.patch('/update-profile', authMiddleware_1.authenticate, userController_1.updateProfile);
// sequence or userSequence
// router.get('/sequence-calender', authenticate, sequence)
// router.get('/sequence-with-legs', authenticate, sequenceWithLegs)
router.get('/calender-sequence', authMiddleware_1.authenticate, userController_1.sequence);
router.get('/sequence-search', authMiddleware_1.authenticate, userController_1.sequenceWithLegs);
// router.get('/fetch-seqcrewpos-by-effdate', authenticate, fetchSeqCrewPosByEffDate)
router.get('/filter-by-date', authMiddleware_1.authenticate, userController_1.filterByDate);
router.patch('/apply-position', authMiddleware_1.authenticate, userController_1.applyPosition);
router.delete('/delete-sequence', authMiddleware_1.authenticate, userController_1.deleteSequence);
router.get('/base-pay', authMiddleware_1.authenticate, userController_1.basePay);
router.patch('/update-reserve', authMiddleware_1.authenticate, userController_1.updateReserve);
router.get('/get-stubs/:flightNumber', userController_1.getStubs);
router.get('/get-12-month-sequence-data', authMiddleware_1.authenticate, userController_1.get12MonthSequenceData);
router.get('/search-by-month', authMiddleware_1.authenticate, userController_1.searchByMonth);
exports.default = router;
