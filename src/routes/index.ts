import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import flightawareRoutes from './flightawareRoutes';
import adminRoutes from './adminRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/flight', flightawareRoutes);
router.use('/admin', adminRoutes);

export default router;
