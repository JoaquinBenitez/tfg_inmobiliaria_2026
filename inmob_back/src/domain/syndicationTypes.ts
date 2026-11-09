/**
 * Vocabulario canónico de sindicación (Fase 3). El modelo de persistencia JobLog
 * importa estos valores para que los identificadores de canal tengan exactamente
 * una única fuente de verdad.
 */
export const JOB_CHANNELS = ['meta-graph', 'xml-feed', 'json-feed'] as const;
export type JobChannel = (typeof JOB_CHANNELS)[number];

export const JOB_STATUSES = ['queued', 'processing', 'success', 'retrying', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Presupuesto de intentos por job de sindicación (Requisito 2: reintentos con backoff exponencial). */
export const SYNDICATION_MAX_ATTEMPTS = 5;

/**
 * La Instagram Graph API limita la publicación de contenido a 25 posts por usuario IG
 * en ventana móvil de 24 h. Empezamos a diferir a los 20 éxitos registrados para
 * quedarnos con margen bajo el límite (el contador también cubre los posts de
 * Facebook, conservadoramente).
 */
export const META_DAILY_BUDGET = 20;
export const META_BUDGET_WINDOW_MS = 24 * 60 * 60 * 1000;
export const META_BUDGET_RETRY_AFTER_MS = 6 * 60 * 60 * 1000;
