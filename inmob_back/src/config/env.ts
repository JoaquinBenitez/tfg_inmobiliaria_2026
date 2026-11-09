
export interface EnvironmentConfig {
  JWT_SECRET: string;
  MONGODB_URI: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  PORT: number;
  NODE_ENV: string;
  IMAGE_STORAGE_TYPE: 'local' | 'cloudinary';
  /** Sindicación (Fase 3) */
  REDIS_URL: string;
  SYNDICATION_CHANNELS: string[];
  /** Secreto compartido para la UI de Bull Board; vacío = board deshabilitado */
  QUEUE_BOARD_TOKEN: string;
  PUBLIC_SITE_URL: string;
  META_APP_ID: string;
  META_PAGE_ID: string;
  META_IG_USER_ID: string;
  META_ACCESS_TOKEN: string;
  META_GRAPH_VERSION: string;
  META_SANDBOX: boolean;
}

/**
 * Valida que todas las variables de entorno requeridas estén presentes y sean válidas
 * @throws Error si falta alguna variable de entorno requerida o es inválida
 * @returns Objeto EnvironmentConfig con las variables de entorno validadas
 */
export const validateEnvironment = (): EnvironmentConfig => {
  const errors: string[] = [];

  // Validar IMAGE_STORAGE_TYPE
  const imageStorageType = process.env.IMAGE_STORAGE_TYPE || 'cloudinary';
  if (!['local', 'cloudinary'].includes(imageStorageType)) {
    errors.push('IMAGE_STORAGE_TYPE must be either "local" or "cloudinary"');
  }

  // Variables de entorno siempre requeridas
  const alwaysRequiredVars = [
    'JWT_SECRET',
    'MONGODB_URI'
  ];

  // Las variables de Cloudinary solo son requeridas si se usa almacenamiento cloudinary
  const cloudinaryRequiredVars = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];

  // Verificar variables siempre requeridas faltantes
  alwaysRequiredVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  });

  // Verificar variables de Cloudinary faltantes solo si se usa almacenamiento cloudinary
  if (imageStorageType === 'cloudinary') {
    cloudinaryRequiredVars.forEach(varName => {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable for Cloudinary storage: ${varName}`);
      }
    });
  }

  // Validar fortaleza de JWT_SECRET
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long for security');
    }
    if (process.env.JWT_SECRET === 'fallback-secret' || 
        process.env.JWT_SECRET === 'your-secret-key' ||
        process.env.JWT_SECRET === 'secret') {
      errors.push('JWT_SECRET cannot use default or weak values');
    }
  }

  // Validar formato del URI de MongoDB
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.startsWith('mongodb')) {
    errors.push('MONGODB_URI must be a valid MongoDB connection string');
  }

  // Validar PORT
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push('PORT must be a valid number between 1 and 65535');
  }

  // Validar NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push('NODE_ENV must be one of: development, production, test');
  }

  // Env de sindicación: todo opcional para que la app arranque sin Redis/Meta.
  // Los identificadores de canal se validan contra JOB_CHANNELS en la fábrica de canales.
  const syndicationChannels = (process.env.SYNDICATION_CHANNELS ?? '')
    .split(',')
    .map(channel => channel.trim())
    .filter(channel => channel.length > 0);
  const metaSandbox = process.env.META_SANDBOX !== 'false'; // dry-run por defecto
  const metaChannelsEnabled = syndicationChannels.includes('meta-graph');
  if (metaChannelsEnabled && !metaSandbox && !process.env.META_ACCESS_TOKEN) {
    errors.push('META_ACCESS_TOKEN is required when meta-graph is enabled and META_SANDBOX=false');
  }

  // Si hay errores de validación, lanzarlos
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  // Devolver la configuración validada
  return {
    JWT_SECRET: process.env.JWT_SECRET!,
    MONGODB_URI: process.env.MONGODB_URI!,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
    PORT: port,
    NODE_ENV: nodeEnv,
    IMAGE_STORAGE_TYPE: imageStorageType as 'local' | 'cloudinary',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    SYNDICATION_CHANNELS: syndicationChannels,
    QUEUE_BOARD_TOKEN: process.env.QUEUE_BOARD_TOKEN || '',
    PUBLIC_SITE_URL: (process.env.PUBLIC_SITE_URL || 'http://localhost:3001').replace(/\/$/, ''),
    META_APP_ID: process.env.META_APP_ID || '',
    META_PAGE_ID: process.env.META_PAGE_ID || '',
    META_IG_USER_ID: process.env.META_IG_USER_ID || '',
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || '',
    // TODO: verificar vigencia de la versión al desplegar (Meta versions live ~2 years)
    META_GRAPH_VERSION: process.env.META_GRAPH_VERSION || 'v23.0',
    META_SANDBOX: metaSandbox
  };
};

/**
 * Obtiene la configuración de entorno validada
 * Se llama una sola vez al arrancar y queda cacheada
 */
export const env = validateEnvironment();

/**
 * Indica si estamos en entorno de producción
 */
export const isProduction = () => env.NODE_ENV === 'production';

/**
 * Indica si estamos en entorno de desarrollo
 */
export const isDevelopment = () => env.NODE_ENV === 'development';

/**
 * Indica si estamos en entorno de test
 */
export const isTest = () => env.NODE_ENV === 'test';