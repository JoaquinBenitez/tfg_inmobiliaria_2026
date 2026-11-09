import { env } from '@/config/env';
import { endpoints } from '@/config/endpoints';

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

export async function fetchApi<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${env.API_URL}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || errorBody?.message || `API Error: ${response.statusText}`;
        throw new ApiError(response.status, message);
    }

    return response.json();
}

export async function uploadFiles<T>(
    endpoint: string,
    files: File[],
    additionalData?: object,
    headers?: Record<string, string>
): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${env.API_URL}${endpoint}`;

    const formData = new FormData();

    // Agregar los archivos al form data
    files.forEach((file) => {
        formData.append('images', file);
    });

    // Agregar datos adicionales si se proveyeron
    if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
        });
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers || {},
        body: formData,
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || errorBody?.message || `Upload Error: ${response.statusText}`;
        throw new ApiError(response.status, message);
    }

    return response.json();
}

export async function createPropertyWithImages<T>(
    propertyData: object,
    images: File[],
    headers?: Record<string, string>
): Promise<T> {
    return uploadFiles<T>(endpoints.properties.create, images, propertyData, headers);
}

export async function uploadPropertyImages<T>(
    propertyId: string,
    images: File[],
    headers?: Record<string, string>
): Promise<T> {
    return uploadFiles<T>(endpoints.properties.uploadImages(propertyId), images, undefined, headers);
} 