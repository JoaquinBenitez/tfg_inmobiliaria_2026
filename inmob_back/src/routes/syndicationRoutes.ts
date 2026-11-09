import { Router } from 'express';
import { getSyndicationStatus, retrySyndicationPublication } from '../controllers/syndicationController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Tablero de publicación (solo admin)
router.get('/status', authenticateToken, requireAdmin, getSyndicationStatus);
router.post('/retry', authenticateToken, requireAdmin, retrySyndicationPublication);

export default router;
