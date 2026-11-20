import { Router } from 'express';
import { changePassword, forgotPassword, getMe, login, resetPassword, verifyOtp } from '../controllers/authController.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/change-password', requireAdmin, changePassword);
router.get('/me', requireAdmin, getMe);

export default router;
