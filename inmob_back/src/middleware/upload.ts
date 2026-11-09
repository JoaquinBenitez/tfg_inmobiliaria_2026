import multer from 'multer';

// Configurar multer con memoria (luego se sube a Cloudinary)
const storage = multer.memoryStorage();

// Filtro de archivos para permitir solo imágenes
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'));
    }
};

// Configurar multer
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // Límite 10MB
        files: 30 // Máximo 30 archivos por subida
    }
});

// Middleware para subida de una sola imagen
export const uploadSingle = upload.single('image');

// Panoramas del tour: un solo archivo, los panos de celular son grandes (10-40MB) y se procesan con sharp
const tourUpload = multer({
    storage,
    fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only panorama image files are allowed (jpeg, png, webp, avif)'));
        }
    },
    limits: {
        fileSize: 40 * 1024 * 1024, // 40MB — panoramas de celular a resolución completa
        files: 1
    }
});

export const uploadTourPanorama = tourUpload.single('panorama');

// Middleware para subida de múltiples imágenes (imágenes de propiedades)
export const uploadMultiple = upload.array('images', 30);