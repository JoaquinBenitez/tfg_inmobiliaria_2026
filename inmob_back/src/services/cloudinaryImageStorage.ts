import cloudinary from '../config/cloudinary';
import { UploadApiResponse } from 'cloudinary';
import { ImageStorageProvider, ImageUploadResult } from '../interfaces/imageStorage';
import { logger } from '../config/logger';

export class CloudinaryImageStorage implements ImageStorageProvider {
    
    async uploadImage(buffer: Buffer, folder: string = 'properties'): Promise<ImageUploadResult> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'image',
                    transformation: [
                        { quality: 'auto', fetch_format: 'auto' },
                        { width: 1200, height: 800, crop: 'limit' }
                    ]
                },
                (error, result: UploadApiResponse | undefined) => {
                    if (error) {
                        reject(error);
                    } else if (result) {
                        resolve({
                            url: result.secure_url,
                            publicId: result.public_id
                        });
                    } else {
                        reject(new Error('Upload failed'));
                    }
                }
            ).end(buffer);
        });
    }

    async uploadMultipleImages(buffers: Buffer[], folder: string = 'properties'): Promise<ImageUploadResult[]> {
        const uploadPromises = buffers.map(buffer => this.uploadImage(buffer, folder));
        return Promise.all(uploadPromises);
    }

    async deleteImage(publicId: string): Promise<void> {
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            logger.error({ err: error, publicId }, 'Error deleting image from Cloudinary');
            throw error;
        }
    }

    async deleteMultipleImages(publicIds: string[]): Promise<void> {
        const deletePromises = publicIds.map(id => this.deleteImage(id));
        await Promise.all(deletePromises);
    }
}