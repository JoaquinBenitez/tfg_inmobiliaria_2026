import { ImageStorageFactory } from '../services/imageStorageFactory';

// Re-export de la interface por compatibilidad hacia atrás
export { ImageUploadResult } from '../interfaces/imageStorage';

// Los helpers puros de URL/storage-id viven en la capa de dominio
export { extractPublicId, extractLocalPath, extractStorageId } from '../domain/storageId';
import { extractStorageId } from '../domain/storageId';

/**
 * Sube una sola imagen usando el proveedor de storage configurado
 * @param buffer - Buffer de la imagen
 * @param folder - Carpeta para organizar imágenes
 * @returns Promise con el resultado de la subida
 */
export const uploadImage = async (
    buffer: Buffer, 
    folder: string = 'properties'
): Promise<{ url: string; publicId: string }> => {
    const storageProvider = ImageStorageFactory.getStorageProvider();
    return await storageProvider.uploadImage(buffer, folder);
};

/**
 * Sube múltiples imágenes usando el proveedor de storage configurado
 * @param buffers - Array de buffers de imagen
 * @param folder - Carpeta para organizar imágenes
 * @returns Promise con array de resultados de la subida
 */
export const uploadMultipleImages = async (
    buffers: Buffer[], 
    folder: string = 'properties'
): Promise<{ url: string; publicId: string }[]> => {
    const storageProvider = ImageStorageFactory.getStorageProvider();
    return await storageProvider.uploadMultipleImages(buffers, folder);
};

/**
 * Borra una imagen usando el proveedor de storage configurado
 * @param publicId - Identificador de la imagen
 * @returns Promise al completar el borrado
 */
export const deleteImage = async (publicId: string): Promise<void> => {
    const storageProvider = ImageStorageFactory.getStorageProvider();
    return await storageProvider.deleteImage(publicId);
};

/**
 * Borra múltiples imágenes usando el proveedor de storage configurado
 * @param publicIds - Array de identificadores de imagen
 * @returns Promise al completar todos los borrados
 */
export const deleteMultipleImages = async (publicIds: string[]): Promise<void> => {
    const storageProvider = ImageStorageFactory.getStorageProvider();
    return await storageProvider.deleteMultipleImages(publicIds);
};

/**
 * Extrae el public ID de Cloudinary desde una URL segura.
 * (Implementación movida a src/domain/storageId.ts — re-exportada arriba.)
 */

/**
 * Borra imágenes por sus URLs, extrayendo primero los identificadores de storage
 * @param urls - Array de URLs de imagen
 * @returns Promise al completar todos los borrados
 */
export const deleteImagesByUrls = async (urls: string[]): Promise<void> => {
    const publicIds = urls.map(extractStorageId).filter((id): id is string => id !== null);
    if (publicIds.length > 0) {
        await deleteMultipleImages(publicIds);
    }
};