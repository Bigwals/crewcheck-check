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
router.post('/upload-avatar', authMiddleware_1.authenticate, upload_1.upload.single('file'), userController_1.uploadAvatar);
// sequence or userSequence
router.get('/sequence', authMiddleware_1.authenticate, userController_1.sequence);
exports.default = router;
