import { Router } from 'express';
import { ingestMetrics, getMetricsSummary } from '../controllers/metricController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { metricsLimiter } from '../middleware/rateLimiter';

const router = Router();

// Público (rate-limited) — ingesta de CWV/FPS del cliente
router.post('/', metricsLimiter, ingestMetrics);

// Solo admin — resumen agregado
router.get('/summary', authenticateToken, requireAdmin, getMetricsSummary);

export default router;
