import { Router } from 'express';
import {
  adminLogin,
  adminSignup,
  exportAdminUsersCsv,
  getAdminUserDetails,
  listAdminUsers,
  updateAdminUserDetails,
  getAdminDashboard,
  broadcastAdminNotification,
} from '../controllers/adminController';
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.post('/signup', adminSignup);
router.post('/login', adminLogin);

router.get('/dashboard', authenticate, authorizeAdmin, getAdminDashboard);
router.post('/notifications/broadcast', authenticate, authorizeAdmin, broadcastAdminNotification);
router.get('/users',authenticate, authorizeAdmin, listAdminUsers);
router.get('/users/export', authenticate, authorizeAdmin, exportAdminUsersCsv);
router.get('/users/:crewId', authenticate, authorizeAdmin, getAdminUserDetails);
router.patch('/users/:crewId', authenticate, authorizeAdmin, updateAdminUserDetails);

export default router;
