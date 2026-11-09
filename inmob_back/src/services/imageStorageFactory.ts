import { ImageStorageProvider } from '../interfaces/imageStorage';
import { CloudinaryImageStorage } from './cloudinaryImageStorage';
import { LocalImageStorage } from './localImageStorage';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class ImageStorageFactory {
    private static instance: ImageStorageProvider | null = null;

    static getStorageProvider(): ImageStorageProvider {
        if (!this.instance) {
            if (env.IMAGE_STORAGE_TYPE === 'local') {
                logger.info({ provider: 'local' }, 'Image storage provider selected');
                this.instance = new LocalImageStorage();
            } else {
                logger.info({ provider: 'cloudinary' }, 'Image storage provider selected');
                this.instance = new CloudinaryImageStorage();
            }
        }
        return this.instance;
    }

    // Método para resetear la instancia con fines de testing
    static resetInstance(): void {
        this.instance = null;
    }
}