export interface ImageUploadResult {
    url: string;
    publicId: string;
}

export interface ImageStorageProvider {
    /**
     * Sube una sola imagen
     * @param buffer - Buffer de la imagen
     * @param folder - Carpeta/directorio para organizar imágenes
     * @returns Promise con el resultado de la subida
     */
    uploadImage(buffer: Buffer, folder?: string): Promise<ImageUploadResult>;

    /**
     * Sube múltiples imágenes
     * @param buffers - Array de buffers de imagen
     * @param folder - Carpeta/directorio para organizar imágenes
     * @returns Promise con array de resultados de la subida
     */
    uploadMultipleImages(buffers: Buffer[], folder?: string): Promise<ImageUploadResult[]>;

    /**
     * Borra una imagen
     * @param publicId - Identificador de la imagen a borrar
     * @returns Promise al completar el borrado
     */
    deleteImage(publicId: string): Promise<void>;

    /**
     * Borra múltiples imágenes
     * @param publicIds - Array de identificadores de imagen
     * @returns Promise al completar todos los borrados
     */
    deleteMultipleImages(publicIds: string[]): Promise<void>;
}