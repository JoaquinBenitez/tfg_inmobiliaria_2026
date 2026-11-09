import { Router } from 'express';
import propertyRoutes from './propertyRoutes';
import authRoutes from './authRoutes';
import settingsRoutes from './settingsRoutes';
import metricsRoutes from './metricsRoutes';
import feedRoutes from './feedRoutes';
import syndicationRoutes from './syndicationRoutes';

const router = Router();

router.use('/properties', propertyRoutes);
router.use('/auth', authRoutes);
router.use('/settings', settingsRoutes);
router.use('/metrics', metricsRoutes);
router.use('/feeds', feedRoutes);
router.use('/admin/syndication', syndicationRoutes);

export default router;
