import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import flightawareRoutes from './flightawareRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/flight', flightawareRoutes);

export default router;
