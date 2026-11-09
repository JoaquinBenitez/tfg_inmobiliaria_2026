import { Router } from 'express';
import {
    getAllProperties,
    createProperty,
    getPropertyById,
    updateProperty,
    deleteProperty,
    deletePropertyImage,
    searchProperties,
    advancedSearchProperties,
    getFeaturedProperties,
    getBedroomOptions,
    getLocationOptions,
    getPropertyTypeOptions,
    uploadPropertyImages,
    searchNearby,
    searchInBounds,
    getPropertyTour,
    uploadTourScene,
    updatePropertyTour,
    deleteTourScene
} from '../controllers/propertyController';
import { uploadMultiple, uploadTourPanorama } from '../middleware/upload';
import { authenticateToken, requireAdminOrEditor } from '../middleware/auth';
import {
    searchLimiter,
    propertyModifyLimiter,
    uploadLimiter
} from '../middleware/rateLimiter';

const router = Router();

// Rutas públicas con rate limiting de búsqueda
router.get('/all', searchLimiter, getAllProperties);
router.get('/getOne/:id', getPropertyById);
router.get('/search', searchLimiter, searchProperties);
router.get('/search/advanced', searchLimiter, advancedSearchProperties);
router.get('/nearby', searchLimiter, searchNearby);
router.get('/bounds', searchLimiter, searchInBounds);
router.get('/featured', getFeaturedProperties);

// Rutas protegidas con autenticación y rate limiting de modificación
router.post('/create', authenticateToken, requireAdminOrEditor, propertyModifyLimiter, uploadMultiple, createProperty);
router.put('/update/:id', authenticateToken, requireAdminOrEditor, propertyModifyLimiter, updateProperty);
router.delete('/delete/:id', authenticateToken, requireAdminOrEditor, propertyModifyLimiter, deleteProperty);

// Subida y borrado de imágenes con autenticación
router.post('/:id/images', authenticateToken, requireAdminOrEditor, uploadLimiter, uploadMultiple, uploadPropertyImages);
router.delete('/:id/images', authenticateToken, requireAdminOrEditor, propertyModifyLimiter, deletePropertyImage);

// Endpoints del recorrido 360° (Requisito 1)
router.get('/:id/tour', getPropertyTour);
router.post('/:id/tour/scenes', authenticateToken, requireAdminOrEditor, uploadLimiter, uploadTourPanorama, uploadTourScene);
router.patch('/:id/tour', authenticateToken, requireAdminOrEditor, propertyModifyLimiter, updatePropertyTour);
router.delete('/:id/tour/scenes/:sceneId', authenticateToken, requireAdminOrEditor, propertyModifyLimiter, deleteTourScene);

// Endpoints de filtros
router.get('/filters/bedrooms', getBedroomOptions);
router.get('/filters/locations', getLocationOptions);
router.get('/filters/property-types', getPropertyTypeOptions);

export default router;
