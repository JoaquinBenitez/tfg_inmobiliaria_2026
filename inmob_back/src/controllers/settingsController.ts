import { Request, Response } from 'express';
import SiteSettings from '../models/SiteSettings';
import { logger } from '../config/logger';
import { uploadMultipleImages, deleteImagesByUrls } from '../utils/imageUpload';

/**
 * Obtiene los settings del hero (público)
 * @route GET /settings/hero
 */
export const getHeroSettings = async (req: Request, res: Response) => {
    try {
        const settings = await (SiteSettings as any).getSettings();
        res.json({
            heroImages: settings.heroImages || [],
            heroTitle: settings.heroTitle || '',
            heroSubtitle: settings.heroSubtitle || '',
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching hero settings');
        res.status(500).json({
            message: 'Error fetching hero settings',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Actualiza los settings del hero (solo admin, multipart form data)
 * @route PUT /settings/hero
 */
export const updateHeroSettings = async (req: Request, res: Response) => {
    try {
        const { heroTitle, heroSubtitle, existingImages } = req.body;

        // Parsear imágenes existentes desde string JSON
        let keepImages: string[] = [];
        if (existingImages) {
            try {
                keepImages = JSON.parse(existingImages);
                if (!Array.isArray(keepImages)) {
                    keepImages = [];
                }
            } catch {
                keepImages = [];
            }
        }

        // Subir archivos nuevos si los hay
        let newImageUrls: string[] = [];
        const files = req.files as Express.Multer.File[] | undefined;
        if (files && files.length > 0) {
            const buffers = files.map(f => f.buffer);
            const uploadResults = await uploadMultipleImages(buffers, 'hero');
            newImageUrls = uploadResults.map(r => r.url);
        }

        const allImages = [...keepImages, ...newImageUrls];

        // Validar total de imágenes <= 3
        if (allImages.length > 3) {
            // Limpiar las imágenes recién subidas porque rechazamos
            if (newImageUrls.length > 0) {
                await deleteImagesByUrls(newImageUrls);
            }
            res.status(400).json({
                message: 'Maximum 3 hero images allowed'
            });
            return;
        }

        // Determinar qué imágenes viejas se eliminaron
        const currentSettings = await (SiteSettings as any).getSettings();
        const previousImages: string[] = currentSettings.heroImages || [];
        const removedImages = previousImages.filter(img => !keepImages.includes(img));

        // Borrar del storage las imágenes eliminadas
        if (removedImages.length > 0) {
            await deleteImagesByUrls(removedImages);
        }

        // Validar campos de texto
        if (heroTitle && heroTitle.length > 200) {
            res.status(400).json({ message: 'Hero title must not exceed 200 characters' });
            return;
        }
        if (heroSubtitle && heroSubtitle.length > 300) {
            res.status(400).json({ message: 'Hero subtitle must not exceed 300 characters' });
            return;
        }

        // Upsert de los settings
        const settings = await SiteSettings.findOneAndUpdate(
            { key: 'site_settings' },
            {
                heroImages: allImages,
                heroTitle: heroTitle || '',
                heroSubtitle: heroSubtitle || '',
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        ).lean();

        res.json({
            heroImages: settings.heroImages,
            heroTitle: settings.heroTitle,
            heroSubtitle: settings.heroSubtitle,
        });
    } catch (error) {
        logger.error({ err: error }, 'Error updating hero settings');
        res.status(500).json({
            message: 'Error updating hero settings',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Borra una sola imagen del hero (solo admin)
 * @route DELETE /settings/hero/images
 */
export const deleteHeroImage = async (req: Request, res: Response) => {
    try {
        const { imageUrl } = req.body;

        if (!imageUrl || typeof imageUrl !== 'string') {
            res.status(400).json({ message: 'imageUrl is required' });
            return;
        }

        const settings = await (SiteSettings as any).getSettings();
        const currentImages: string[] = settings.heroImages || [];

        if (!currentImages.includes(imageUrl)) {
            res.status(404).json({ message: 'Image not found in hero settings' });
            return;
        }

        // Quitar del storage
        await deleteImagesByUrls([imageUrl]);

        // Actualizar settings
        const updatedSettings = await SiteSettings.findOneAndUpdate(
            { key: 'site_settings' },
            { $pull: { heroImages: imageUrl } },
            { returnDocument: 'after' }
        ).lean();

        res.json({
            heroImages: updatedSettings?.heroImages || [],
            heroTitle: updatedSettings?.heroTitle || '',
            heroSubtitle: updatedSettings?.heroSubtitle || '',
        });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting hero image');
        res.status(500).json({
            message: 'Error deleting hero image',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
