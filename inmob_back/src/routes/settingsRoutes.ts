import { Router } from 'express';
import { getHeroSettings, updateHeroSettings, deleteHeroImage } from '../controllers/settingsController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { uploadMultiple } from '../middleware/upload';

const router = Router();

// Público
router.get('/hero', getHeroSettings);

// Solo admin
router.put('/hero', authenticateToken, requireAdmin, uploadMultiple, updateHeroSettings);
router.delete('/hero/images', authenticateToken, requireAdmin, deleteHeroImage);

export default router;
