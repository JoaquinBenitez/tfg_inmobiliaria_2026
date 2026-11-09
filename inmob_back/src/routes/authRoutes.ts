import { Router } from 'express';
import {
    login,
    register,
    getCurrentUser,
    updateProfile,
    resetUserPassword
} from '../controllers/authController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// Rutas públicas con rate limiting estricto
router.post('/login', authLimiter, login);

// Rutas protegidas
router.use(authenticateToken); // All routes below require authentication

router.get('/me', getCurrentUser);
router.put('/profile', updateProfile);

// Rutas solo para admin
router.post('/register', authLimiter, requireAdmin, register);
router.put('/users/:id/password', authLimiter, requireAdmin, resetUserPassword);

export default router;
