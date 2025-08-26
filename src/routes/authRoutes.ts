import { Router } from 'express';
// import { register, verifyOTP, login, resendOtp, forgotPassword, resetPassword, sendPasswordOnEmail } from '../controllers/authController';
import { register, verifyOTP, login, resendOtp, forgotPassword, resetPassword } from '../controllers/authController';
const router = Router();

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/login', login);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
// router.post('/send-password', sendPasswordOnEmail);
router.post('/reset-password', resetPassword);

export default router;
