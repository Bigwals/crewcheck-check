"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const upload_1 = require("../middlewares/upload");
// import { changePassword } from '../controllers/authControllerNew';
const router = (0, express_1.Router)();
// authenticate
// router.post('/reset-password', authenticate, resetPassword);
router.post('/change-password', authMiddleware_1.authenticate, userController_1.changePassword);
router.get('/get-profile', authMiddleware_1.authenticate, userController_1.getProfile);
router.get('/get-crew-bases', authMiddleware_1.authenticate, userController_1.getCrewBaseRanking);
router.post('/upload-avatar', authMiddleware_1.authenticate, upload_1.upload.single('file'), userController_1.uploadAvatar);
// sequence or userSequence
router.get('/sequence-calender', authMiddleware_1.authenticate, userController_1.sequence);
router.get('/sequence-with-legs', authMiddleware_1.authenticate, userController_1.sequenceWithLegs);
router.get('/filter-by-date', authMiddleware_1.authenticate, userController_1.filterByDate);
router.patch('/apply-position', authMiddleware_1.authenticate, userController_1.applyPosition);
router.delete('/delete-sequence', authMiddleware_1.authenticate, userController_1.deleteSequence);
router.get('/base-pay', authMiddleware_1.authenticate, userController_1.basePay);
router.patch('/update-reserve', authMiddleware_1.authenticate, userController_1.updateReserve);
router.get('/get-stubs/:flightNumber', userController_1.getStubs);
exports.default = router;
