import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import flightawareRoutes from './flightawareRoutes';
import adminRoutes from './adminRoutes';
import vacationRoutes from './vacationRoutes';
import syncRoutes from './syncRoutes';


const router = Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/user', vacationRoutes);
router.use('/flight', flightawareRoutes);
router.use('/admin', adminRoutes);
router.use('/sync', syncRoutes);

export default router;
