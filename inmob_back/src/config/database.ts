import mongoose from 'mongoose';
import { logger } from './logger';

/**
 * Configuración de conexión a MongoDB con connection pooling
 * Los ajustes del pool optimizan el rendimiento de la base y el uso de recursos
 */
export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI!, {
            // Configuración del pool de conexiones
            maxPoolSize: 10,        // Máximo de conexiones en el pool (default: 100)
            minPoolSize: 2,         // Mínimo de conexiones abiertas (default: 0)

            // Ajustes de timeout
            serverSelectionTimeoutMS: 5000,  // Timeout para seleccionar un servidor (default: 30000)
            socketTimeoutMS: 45000,          // Timeout para operaciones de socket (default: 0 = sin timeout)

            // Gestión de conexiones
            maxIdleTimeMS: 60000,    // Tiempo máximo de inactividad antes de cerrar una conexión (default: 0)

            // Monitoreo y debugging
            // En producción poner false para reducir el logging
            autoIndex: process.env.NODE_ENV !== 'production', // Auto-crear índices (deshabilitar en prod)
        });

        logger.info(
            { host: conn.connection.host, poolMin: 2, poolMax: 10 },
            'MongoDB connected'
        );

        // Loguear eventos del pool de conexiones (útil para debugging)
        mongoose.connection.on('connected', () => {
            logger.debug('MongoDB connection pool established');
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB connection pool disconnected');
        });

        mongoose.connection.on('error', (err) => {
            logger.error({ err }, 'MongoDB connection pool error');
        });

    } catch (error) {
        logger.error({ err: error }, 'Error connecting to MongoDB');
        process.exit(1);
    }
};
