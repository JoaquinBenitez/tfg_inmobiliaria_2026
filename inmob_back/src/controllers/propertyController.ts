import { Request, Response } from 'express';
import { AppError, ValidationFailedError } from '../domain/appError';
import {
    BEDROOM_OPTIONS,
    LOCATION_OPTIONS,
    PROPERTY_TYPE_OPTIONS
} from '../domain/propertyFilters';
import { PropertyRepositoryFactory } from '../infrastructure/propertyRepositoryFactory';
import { ImageStorageFactory } from '../services/imageStorageFactory';
import { propertyService } from '../application/propertyService';
import { propertyImageService } from '../application/propertyImageService';
import { propertySearchService } from '../application/propertySearchService';
import { tourService } from '../application/tourService';
import { toPropertyDto } from './propertySerializer';
import { logger } from '../config/logger';

const getRepo = () => PropertyRepositoryFactory.getRepository();
const getStorage = () => ImageStorageFactory.getStorageProvider();

const extractBuffers = (req: Request): Buffer[] => {
    const files = req.files as Express.Multer.File[] | undefined;
    return files && Array.isArray(files) && files.length > 0
        ? files.map((file: Express.Multer.File) => file.buffer)
        : [];
};

function sendAppError(res: Response, error: AppError): void {
    const body: Record<string, unknown> = { message: error.message, ...(error.extra ?? {}) };
    if (error instanceof ValidationFailedError) {
        body.errors = error.errors;
    }
    res.status(error.statusCode).json(body);
}

export const getAllProperties = async (req: Request, res: Response) => {
    try {
        const response = await propertySearchService.listProperties(getRepo(), req.query as Record<string, unknown>);
        res.json({ ...response, properties: response.properties.map(toPropertyDto) });
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        logger.error({ err: error }, 'Error fetching properties');
        res.status(500).json({
            message: 'Error fetching properties',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const createProperty = async (req: Request, res: Response) => {
    try {
        const savedProperty = await propertyService.createProperty(getRepo(), getStorage(), {
            data: req.body,
            imageBuffers: extractBuffers(req)
        });
        res.status(201).json(toPropertyDto(savedProperty));
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        res.status(400).json({ message: 'Error creating property', error: error instanceof Error ? error.message : String(error) });
    }
};

export const getPropertyById = async (req: Request, res: Response) => {
    try {
        const property = await propertyService.getPropertyById(getRepo(), req.params.id);
        res.json(toPropertyDto(property));
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        res.status(500).json({ message: 'Error fetching property', error });
    }
};

export const updateProperty = async (req: Request, res: Response) => {
    try {
        const property = await propertyService.updateProperty(getRepo(), getStorage(), req.params.id, req.body);
        res.json(toPropertyDto(property));
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        res.status(500).json({ message: 'Error updating property', error });
    }
};

export const deleteProperty = async (req: Request, res: Response) => {
    try {
        const property = await propertyService.deleteProperty(getRepo(), getStorage(), req.params.id);
        res.json({
            message: 'Property deleted successfully',
            id: property.id
        });
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        res.status(500).json({ message: 'Error deleting property', error });
    }
};

export const searchProperties = async (req: Request, res: Response) => {
    try {
        const properties = await propertySearchService.searchProperties(getRepo(), req.query as Record<string, unknown>);
        res.json(properties.map(toPropertyDto));
    } catch (error) {
        res.status(500).json({
            message: 'Error searching properties',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const advancedSearchProperties = async (req: Request, res: Response) => {
    try {
        const properties = await propertySearchService.advancedSearchProperties(getRepo(), req.query as Record<string, unknown>);
        res.json(properties.map(toPropertyDto));
    } catch (error) {
        res.status(500).json({
            message: 'Error in advanced property search',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const getFeaturedProperties = async (req: Request, res: Response) => {
    try {
        const featuredProperties = await propertySearchService.getFeaturedProperties(getRepo());
        res.json(featuredProperties.map(toPropertyDto));
    } catch (error) {
        res.status(500).json({
            message: 'Error fetching featured properties',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const getBedroomOptions = async (req: Request, res: Response) => {
    try {
        res.json(BEDROOM_OPTIONS);
    } catch (error) {
        res.status(500).json({
            message: 'Error fetching bedroom options',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const getLocationOptions = async (req: Request, res: Response) => {
    try {
        res.json(LOCATION_OPTIONS);
    } catch (error) {
        res.status(500).json({
            message: 'Error fetching location options',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const getPropertyTypeOptions = async (req: Request, res: Response) => {
    try {
        res.json(PROPERTY_TYPE_OPTIONS);
    } catch (error) {
        res.status(500).json({
            message: 'Error fetching property type options',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const deletePropertyImage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { images } = await propertyImageService.deleteImage(getRepo(), getStorage(), id, req.body.imageId);
        res.json({ message: 'Image deleted', images });
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        res.status(500).json({ message: 'Error deleting image', error });
    }
};

export const uploadPropertyImages = async (req: Request, res: Response) => {
    try {
        const result = await propertyImageService.uploadImages(getRepo(), getStorage(), req.params.id, extractBuffers(req));
        res.json({
            message: 'Images uploaded successfully',
            images: result.images,
            property: toPropertyDto(result.property)
        });
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        logger.error({ err: error }, 'Error uploading images');
        res.status(500).json({
            message: 'Error uploading images',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const searchNearby = async (req: Request, res: Response) => {
    try {
        const response = await propertySearchService.searchNearby(getRepo(), req.query as Record<string, unknown>);
        res.json({ ...response, properties: response.properties.map(p => ({ ...toPropertyDto(p), distance: p.distance })) });
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        res.status(500).json({
            message: 'Error searching nearby properties',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const searchInBounds = async (req: Request, res: Response) => {
    try {
        const response = await propertySearchService.searchInBounds(getRepo(), req.query as Record<string, unknown>);
        res.json({ ...response, properties: response.properties.map(toPropertyDto) });
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        res.status(500).json({
            message: 'Error searching properties in bounds',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// ---------------------------------------------------------------------------
// 360° tour endpoints (Requirement 1)
// ---------------------------------------------------------------------------

export const getPropertyTour = async (req: Request, res: Response) => {
    try {
        const tour = await tourService.getTour(getRepo(), req.params.id);
        res.json(tour);
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        logger.error({ err: error }, 'Error fetching tour');
        res.status(500).json({ message: 'Error fetching tour', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};

export const uploadTourScene = async (req: Request, res: Response) => {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ message: 'Panorama file is required (field name: "panorama")' });
            return;
        }
        const result = await tourService.addScene(getRepo(), getStorage(), req.params.id, file, req.body?.name);
        res.status(201).json({ message: 'Scene uploaded', scene: result.scene, tour: result.tour });
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        logger.error({ err: error }, 'Error uploading tour scene');
        res.status(500).json({ message: 'Error uploading tour scene', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};

export const updatePropertyTour = async (req: Request, res: Response) => {
    try {
        const tour = await tourService.updateTour(getRepo(), req.params.id, req.body);
        res.json({ message: 'Tour updated', tour });
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        logger.error({ err: error }, 'Error updating tour');
        res.status(500).json({ message: 'Error updating tour', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};

export const deleteTourScene = async (req: Request, res: Response) => {
    try {
        const tour = await tourService.removeScene(getRepo(), getStorage(), req.params.id, req.params.sceneId);
        res.json({ message: 'Scene deleted', tour });
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        logger.error({ err: error }, 'Error deleting tour scene');
        res.status(500).json({ message: 'Error deleting tour scene', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};
