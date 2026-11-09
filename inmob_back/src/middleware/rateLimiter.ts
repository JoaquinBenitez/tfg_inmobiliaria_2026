import rateLimit from 'express-rate-limit';
import { isDevelopment } from '../config/env';

/**
 * Rate limiter general de la API
 * Se aplica a todos los endpoints
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment() ? 1000 : 100, // Máximo 100 requests por IP por ventana en producción
  message: {
    error: 'Too many requests from this IP, please try again later.',
    resetTime: new Date(Date.now() + 15 * 60 * 1000)
  },
  standardHeaders: true, // Devuelve info de rate limit en los headers `RateLimit-*`
  legacyHeaders: false, // Deshabilita los headers `X-RateLimit-*`
  skip: (req) => {
    // Salta el rate limit en tests y para el health check interno
    return process.env.NODE_ENV === 'test' || req.path === '/api/health';
  }
});

/**
 * Rate limiter estricto para los endpoints de autenticación
 * Aplicado a login, registro y restablecimiento de contraseña
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment() ? 50 : 5, // Máximo 5 intentos de login por IP por ventana en producción
  message: {
    error: 'Too many authentication attempts, please try again later.',
    resetTime: new Date(Date.now() + 15 * 60 * 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No cuenta los requests exitosos
  skip: () => process.env.NODE_ENV === 'test', // Salta el rate limit en tests
});

/**
 * Rate limiter medio para creación/actualización de propiedades
 * Aplicado a los endpoints de crear, actualizar y borrar propiedades
 */
export const propertyModifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: isDevelopment() ? 100 : 10, // Máximo 10 modificaciones de propiedades por IP por minuto
  message: {
    error: 'Too many property modifications, please try again later.',
    resetTime: new Date(Date.now() + 60 * 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', // Salta el rate limit en tests
});

/**
 * Rate limiter para subida de imágenes
 * Aplicado a los endpoints de subida de imágenes
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: isDevelopment() ? 50 : 20, // Máximo 20 subidas por IP por minuto
  message: {
    error: 'Too many file uploads, please try again later.',
    resetTime: new Date(Date.now() + 60 * 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', // Salta el rate limit en tests
});

/**
 * Rate limiter para búsquedas
 * Aplicado a los endpoints de búsqueda y filtros
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto  
  max: isDevelopment() ? 200 : 60, // Máximo 60 búsquedas por IP por minuto
  message: {
    error: 'Too many search requests, please try again later.',
    resetTime: new Date(Date.now() + 60 * 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', // Salta el rate limit en tests
});

/**
 * Rate limiter para ingesta de métricas
 * Aplicado a POST /api/metrics (lotes de hasta 50 métricas por request,
 * así el límite generoso igual acota los documentos almacenados por IP)
 */
export const metricsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: isDevelopment() ? 120 : 30, // Máximo 30 lotes de métricas por IP por minuto en producción
  message: {
    error: 'Too many metrics requests, please try again later.',
    resetTime: new Date(Date.now() + 60 * 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', // Salta el rate limit en tests
});

