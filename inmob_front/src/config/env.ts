export const env = {
    ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
    API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
} as const; 