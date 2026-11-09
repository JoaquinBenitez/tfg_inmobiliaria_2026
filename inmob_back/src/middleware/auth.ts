import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { env } from '../config/env';
import { logger } from '../config/logger';

interface JwtPayload {
    userId: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
}

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

/**
 * Middleware de autenticación de tokens JWT
 * Valida el header Authorization y adjunta el usuario al request
 * @param req - Request de Express
 * @param res - Response de Express
 * @param next - Función next de Express
 * @returns void
 */
export const authenticateToken = async (
    req: Request, 
    res: Response, 
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            res.status(401).json({ 
                message: 'Access token required' 
            });
            return;
        }

        // Verificar token JWT
        const decoded = jwt.verify(
            token, 
            env.JWT_SECRET
        ) as JwtPayload;

        // Buscar el usuario en la base para asegurar que la cuenta siga activa
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive) {
            res.status(401).json({ 
                message: 'Invalid token or account deactivated' 
            });
            return;
        }

        // Adjuntar usuario al request
        req.user = user;
        next();

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                message: 'Token expired'
            });
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                message: 'Invalid token'
            });
            return;
        }

        logger.error({ err: error }, 'Authentication error');
        res.status(500).json({ 
            message: 'Internal server error during authentication' 
        });
        return;
    }
};

/**
 * Middleware que verifica si el usuario tiene rol admin
 * Debe usarse después del middleware authenticateToken
 * @param req - Request de Express con el usuario adjunto
 * @param res - Response de Express
 * @param next - Función next de Express
 * @returns void
 */
export const requireAdmin = (
    req: Request, 
    res: Response, 
    next: NextFunction
) => {
    if (!req.user) {
        res.status(401).json({ 
            message: 'Authentication required' 
        });
        return;
    }

    if (req.user.role !== 'admin') {
        res.status(403).json({ 
            message: 'Admin access required' 
        });
        return;
    }

    next();
};

/**
 * Middleware que verifica si el usuario tiene rol admin o editor
 * Debe usarse después del middleware authenticateToken
 * @param req - Request de Express con el usuario adjunto
 * @param res - Response de Express
 * @param next - Función next de Express
 * @returns void
 */
export const requireAdminOrEditor = (
    req: Request, 
    res: Response, 
    next: NextFunction
) => {
    if (!req.user) {
        res.status(401).json({ 
            message: 'Authentication required' 
        });
        return;
    }

    if (!['admin', 'editor'].includes(req.user.role)) {
        res.status(403).json({ 
            message: 'Admin or editor access required' 
        });
        return;
    }

    next();
};

/**
 * Middleware de autenticación opcional
 * Adjunta el usuario al request si se provee un token válido, pero no lo exige
 * @param req - Request de Express
 * @param res - Response de Express
 * @param next - Función next de Express
 * @returns void
 */
export const optionalAuth = async (
    req: Request, 
    res: Response, 
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return next(); // Sin token, continuar sin usuario
        }

        // Verificar token JWT
        const decoded = jwt.verify(
            token, 
            env.JWT_SECRET
        ) as JwtPayload;

        // Buscar el usuario en la base de datos
        const user = await User.findById(decoded.userId);
        if (user && user.isActive) {
            req.user = user;
        }

        next();

    } catch (error) {
        // Si el token es inválido, continuar sin usuario (no lanzar error)
        next();
    }
};