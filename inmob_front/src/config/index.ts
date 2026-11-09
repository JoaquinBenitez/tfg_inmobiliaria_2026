import { env } from './env'
import { endpoints } from './endpoints'
import { routes } from './routes'
import { constants } from './constants'

export const config = {
    env: env.ENVIRONMENT,
    endpoints,
    routes,
    constants: constants[env.ENVIRONMENT as keyof typeof constants],
} as const;

// Exports de tipos
export type Environment = typeof env.ENVIRONMENT
export type Endpoints = typeof endpoints
export type Routes = typeof routes
export type Constants = typeof constants[keyof typeof constants] 