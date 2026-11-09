import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { validatePasswordStrength } from '../utils/passwordValidation';

/**
 * @fileoverview Controlador de autenticación - Gestiona las operaciones de autenticación de usuarios
 * @description Este controlador maneja login, registro y validación de token para usuarios administradores
 * @author Real Estate Backend API
 * @version 1.0.0
 */

/**
 * Autentica un usuario con email y contraseña
 * @route POST /auth/login
 * @param {Request} req - Request de Express con email y contraseña en el body
 * @param {Response} res - Response de Express
 * @returns {Promise<void>} Objeto JSON con los datos del usuario y el token JWT
 * @throws {400} Bad request si falta el email o la contraseña
 * @throws {401} Unauthorized si las credenciales son inválidas
 * @throws {403} Forbidden si la cuenta del usuario está inactiva
 * @throws {500} Error interno del servidor si falla la autenticación
 * @example
 * // POST /api/auth/login
 * // Body: { email: "admin@example.com", password: "password123" }
 * // Response: { user: { id: "...", email: "...", role: "admin" }, token: "jwt_token" }
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Validar entrada
        if (!email || !password) {
            res.status(400).json({ 
                message: 'Email and password are required' 
            });
            return;
        }

        // Buscar usuario por email
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            res.status(401).json({ 
                message: 'Invalid credentials' 
            });
            return;
        }

        // Verificar si el usuario está activo
        if (!user.isActive) {
            res.status(403).json({ 
                message: 'Account is deactivated. Contact administrator.' 
            });
            return;
        }

        // Verificar contraseña
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            res.status(401).json({ 
                message: 'Invalid credentials' 
            });
            return;
        }

        // Generar token JWT
        const token = jwt.sign(
            { 
                userId: user._id, 
                email: user.email, 
                role: user.role 
            },
            env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Devolver datos del usuario sin contraseña
        const userResponse = {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role
        };

        res.json({
            message: 'Login successful',
            user: userResponse,
            token
        });

    } catch (error) {
        logger.error({ err: error }, 'Login error');
        res.status(500).json({ 
            message: 'Internal server error during authentication',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Crea un nuevo usuario admin/editor (solo admin)
 * @route POST /auth/register
 * @param {AuthenticatedRequest} req - Request de Express con los datos del usuario en el body y el usuario autenticado
 * @param {Response} res - Response de Express
 * @returns {Promise<void>} Objeto JSON del usuario creado
 * @throws {400} Bad request si faltan campos obligatorios o el usuario ya existe
 * @throws {401} Unauthorized si no está autenticado
 * @throws {403} Forbidden si el rol no es admin
 * @throws {500} Error interno del servidor si falla el registro
 * @example
 * // POST /api/auth/register
 * // Headers: { Authorization: "Bearer jwt_token" }
 * // Body: { email: "editor@example.com", password: "password123", name: "Editor User", role: "editor" }
 * // Response: { user: { id: "...", email: "...", name: "...", role: "editor" } }
 */
export const register = async (req: Request, res: Response) => {
    try {
        // Verificar que el usuario solicitante sea admin
        if (!req.user || req.user.role !== 'admin') {
            res.status(403).json({ 
                message: 'Only administrators can create new users' 
            });
            return;
        }

        const { email, password, name, role } = req.body;

        // Validar campos obligatorios
        if (!email || !password || !name) {
            res.status(400).json({ 
                message: 'Email, password, and name are required' 
            });
            return;
        }

        // Validar fortaleza de la contraseña
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            res.status(400).json({ 
                message: 'Password does not meet security requirements',
                errors: passwordValidation.errors,
                passwordScore: passwordValidation.score
            });
            return;
        }

        // Validar rol
        if (role && !['admin', 'editor'].includes(role)) {
            res.status(400).json({ 
                message: 'Role must be either admin or editor' 
            });
            return;
        }

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({ 
                message: 'User with this email already exists' 
            });
            return;
        }

        // Crear nuevo usuario
        const newUser = new User({
            email,
            password,
            name,
            role: role || 'editor'
        });

        const savedUser = await newUser.save();

        // Devolver datos del usuario sin contraseña
        const userResponse = {
            id: savedUser._id,
            email: savedUser.email,
            name: savedUser.name,
            role: savedUser.role,
            isActive: savedUser.isActive,
            createdAt: savedUser.createdAt
        };

        res.status(201).json({
            message: 'User created successfully',
            user: userResponse
        });

    } catch (error) {
        logger.error({ err: error }, 'Registration error');
        res.status(500).json({ 
            message: 'Internal server error during registration',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Recuperación de credenciales mediada por admin: restablece la contraseña de un usuario
 * @route PUT /auth/users/:id/password
 */
export const resetUserPassword = async (req: Request, res: Response) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            res.status(403).json({ message: 'Only administrators can reset passwords' });
            return;
        }

        const { password } = req.body;
        if (!password) {
            res.status(400).json({ message: 'Password is required' });
            return;
        }

        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            res.status(400).json({
                message: 'Password does not meet security requirements',
                errors: passwordValidation.errors,
                passwordScore: passwordValidation.score
            });
            return;
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        user.password = password;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Password reset error');
        res.status(500).json({ message: 'Internal server error during password reset' });
    }
};

/**
 * Valida el token JWT y devuelve los datos del usuario
 * @route GET /auth/me
 * @param {AuthenticatedRequest} req - Request de Express con el usuario autenticado
 * @param {Response} res - Response de Express
 * @returns {Promise<void>} Objeto JSON con los datos del usuario actual
 * @throws {401} Unauthorized si el token es inválido o el usuario no existe
 * @throws {500} Error interno del servidor si falla la validación
 * @example
 * // GET /api/auth/me
 * // Headers: { Authorization: "Bearer jwt_token" }
 * // Response: { user: { id: "...", email: "...", name: "...", role: "admin" } }
 */
export const getCurrentUser = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            res.status(401).json({ 
                message: 'User not authenticated' 
            });
            return;
        }

        // Obtener datos frescos del usuario desde la base de datos
        const user = await User.findById(req.user._id);
        if (!user || !user.isActive) {
            res.status(401).json({ 
                message: 'User not found or account deactivated' 
            });
            return;
        }

        // Devolver datos del usuario sin contraseña
        const userResponse = {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive
        };

        res.json({ user: userResponse });

    } catch (error) {
        logger.error({ err: error }, 'Get current user error');
        res.status(500).json({ 
            message: 'Internal server error during user validation',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Actualiza la información del perfil del usuario
 * @route PUT /auth/profile
 * @param {AuthenticatedRequest} req - Request de Express con los datos a actualizar en el body y el usuario autenticado
 * @param {Response} res - Response de Express
 * @returns {Promise<void>} Objeto JSON con los datos actualizados del usuario
 * @throws {400} Bad request si los datos son inválidos
 * @throws {401} Unauthorized si no está autenticado
 * @throws {500} Error interno del servidor si falla la actualización
 * @example
 * // PUT /api/auth/profile
 * // Headers: { Authorization: "Bearer jwt_token" }
 * // Body: { name: "Updated Name" }
 * // Response: { user: { id: "...", email: "...", name: "Updated Name", role: "admin" } }
 */
export const updateProfile = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            res.status(401).json({ 
                message: 'User not authenticated' 
            });
            return;
        }

        const { name } = req.body;
        const allowedUpdates = ['name'];
        const updates = Object.keys(req.body);
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            res.status(400).json({ 
                message: 'Invalid updates. Only name can be updated.' 
            });
            return;
        }

        // Actualizar usuario
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { name },
            { returnDocument: 'after', runValidators: true }
        );

        if (!user) {
            res.status(404).json({ 
                message: 'User not found' 
            });
            return;
        }

        // Devolver datos actualizados del usuario sin contraseña
        const userResponse = {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive
        };

        res.json({
            message: 'Profile updated successfully',
            user: userResponse
        });

    } catch (error) {
        logger.error({ err: error }, 'Update profile error');
        res.status(500).json({ 
            message: 'Internal server error during profile update',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};