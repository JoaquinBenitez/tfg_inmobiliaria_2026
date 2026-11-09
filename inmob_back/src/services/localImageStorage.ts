import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { ImageStorageProvider, ImageUploadResult } from '../interfaces/imageStorage';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class LocalImageStorage implements ImageStorageProvider {
    private uploadsDir: string;

    constructor() {
        // Guardar las subidas en el directorio uploads relativo a la raíz del proyecto
        // UPLOADS_BASE_DIR permite sobreescribir el directorio base (p. ej. para tests)
        this.uploadsDir = process.env.UPLOADS_BASE_DIR || path.join(process.cwd(), 'uploads');
        this.ensureUploadsDirectory();
    }

    private async ensureUploadsDirectory(): Promise<void> {
        try {
            await fs.access(this.uploadsDir);
        } catch {
            await fs.mkdir(this.uploadsDir, { recursive: true });
        }
    }

    private async ensureFolderExists(folderPath: string): Promise<void> {
        try {
            await fs.access(folderPath);
        } catch {
            await fs.mkdir(folderPath, { recursive: true });
        }
    }

    private generateFileName(extension: string): string {
        const timestamp = Date.now();
        const uuid = randomUUID().split('-')[0]; // Usar la primera parte del UUID para un nombre más corto
        return `${timestamp}-${uuid}.${extension}`;
    }

    private getFileExtension(buffer: Buffer): string {
        // Detección simple de magic numbers para formatos de imagen comunes
        if (buffer.length >= 4) {
            const hex = buffer.toString('hex', 0, 4);
            if (hex.startsWith('ffd8')) return 'jpg';
            if (hex.startsWith('8950')) return 'png';
            if (hex.startsWith('4749')) return 'gif';
            if (hex.startsWith('5249')) return 'webp';
            // AVIF/HEIF: ISO BMFF, los bytes 4-8 son 'ftyp'
            if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return 'avif';
        }
        return 'jpg'; // Fallback por defecto
    }

    async uploadImage(buffer: Buffer, folder: string = 'properties'): Promise<ImageUploadResult> {
        await this.ensureUploadsDirectory();
        
        const folderPath = path.join(this.uploadsDir, folder);
        await this.ensureFolderExists(folderPath);
        
        const extension = this.getFileExtension(buffer);
        const fileName = this.generateFileName(extension);
        const filePath = path.join(folderPath, fileName);
        const relativePath = path.join(folder, fileName).replace(/\\/g, '/');
        
        await fs.writeFile(filePath, buffer);
        
        // Devolver el path de URL que servirá el middleware de archivos estáticos
        const url = `${env.NODE_ENV === 'production' ? '' : `http://localhost:${env.PORT}`}/uploads/${relativePath}`;
        
        return {
            url,
            publicId: relativePath // Usar el path relativo como publicId para el borrado
        };
    }

    async uploadMultipleImages(buffers: Buffer[], folder: string = 'properties'): Promise<ImageUploadResult[]> {
        const uploadPromises = buffers.map(buffer => this.uploadImage(buffer, folder));
        return Promise.all(uploadPromises);
    }

    async deleteImage(publicId: string): Promise<void> {
        try {
            const filePath = path.join(this.uploadsDir, publicId);
            await fs.unlink(filePath);
        } catch (error) {
            // Loguear warning pero no lanzar - el archivo puede ya estar borrado
            logger.warn({ publicId, err: error }, 'Could not delete local image file');
        }
    }

    async deleteMultipleImages(publicIds: string[]): Promise<void> {
        const deletePromises = publicIds.map(id => this.deleteImage(id));
        await Promise.all(deletePromises);
    }
}