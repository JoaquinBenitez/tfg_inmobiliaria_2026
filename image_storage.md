# Image Storage System Documentation

## Overview

The real estate application supports configurable image storage with two options: **Cloudinary** (cloud-based) and **Local Filesystem** (server-based). This document explains how the system works internally and how to configure each option.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│  (Property Controller, Image Upload Routes)                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                 Image Upload Utils                          │
│              (src/utils/imageUpload.ts)                    │
│  ▶ uploadImage()  ▶ uploadMultipleImages()                 │
│  ▶ deleteImage()  ▶ deleteMultipleImages()                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                Storage Factory                              │
│           (src/services/imageStorageFactory.ts)           │
│        Returns: LocalImageStorage | CloudinaryImageStorage │
└─────────┬───────────────────────────┬───────────────────────┘
          │                           │
          ▼                           ▼
┌─────────────────────┐    ┌──────────────────────────────────┐
│  Local File Storage │    │     Cloudinary Storage           │
│     (src/services/  │    │      (src/services/              │
│  localImageStorage  │    │  cloudinaryImageStorage.ts)     │
│        .ts)         │    │                                  │
└─────────────────────┘    └──────────────────────────────────┘
          │                           │
          ▼                           ▼
┌─────────────────────┐    ┌──────────────────────────────────┐
│  ./uploads/ folder  │    │      Cloudinary CDN              │
│  Static files served│    │   (cloud-hosted images)         │
│   at /uploads/      │    │                                  │
└─────────────────────┘    └──────────────────────────────────┘
```

## How It Works

### 1. Configuration-Based Selection

The system reads the `IMAGE_STORAGE_TYPE` environment variable and automatically selects the appropriate storage provider:

```typescript
// src/services/imageStorageFactory.ts
static getStorageProvider(): ImageStorageProvider {
    if (env.IMAGE_STORAGE_TYPE === 'local') {
        return new LocalImageStorage();
    } else {
        return new CloudinaryImageStorage();
    }
}
```

### 2. Unified Interface

Both storage providers implement the same interface, ensuring consistent behavior:

```typescript
// src/interfaces/imageStorage.ts
export interface ImageStorageProvider {
    uploadImage(buffer: Buffer, folder?: string): Promise<ImageUploadResult>;
    uploadMultipleImages(buffers: Buffer[], folder?: string): Promise<ImageUploadResult[]>;
    deleteImage(publicId: string): Promise<void>;
    deleteMultipleImages(publicIds: string[]): Promise<void>;
}
```

### 3. Transparent API Layer

The application layer uses the same functions regardless of the storage type:

```typescript
// src/utils/imageUpload.ts
export const uploadImage = async (buffer: Buffer, folder: string = 'properties') => {
    const storageProvider = ImageStorageFactory.getStorageProvider();
    return await storageProvider.uploadImage(buffer, folder);
};
```

### 4. URL-Based Deletion

When a property or image is deleted, stored URLs are resolved back to storage identifiers via `extractStorageId(url)` (`src/utils/imageUpload.ts`):

- Cloudinary URL (`https://res.cloudinary.com/.../upload/v123/properties/x.jpg`) → public ID `properties/x`
- Local URL (`http://localhost:3000/uploads/properties/x.jpg`) → relative path `properties/x.jpg`

The resolved identifier is passed to the active storage provider for deletion, so cleanup works identically for both storage types.

## Storage Implementations

### Local Filesystem Storage

**File Location:** `src/services/localImageStorage.ts`

#### How it works:
1. **File Storage**: Images saved to `./uploads/{folder}/` directory
2. **Unique Naming**: Files named using timestamp + UUID (e.g., `1693123456789-a1b2c3d4.jpg`)
3. **File Type Detection**: Uses magic numbers to detect image format
4. **URL Generation**: Returns URLs like `/uploads/properties/filename.jpg`
5. **Static Serving**: Express serves files from `/uploads/` endpoint

#### File Structure:
```
project-root/
├── uploads/
│   ├── properties/
│   │   ├── 1693123456789-a1b2c3d4.jpg
│   │   ├── 1693123457890-b2c3d4e5.png
│   │   └── ...
│   └── other-folders/
└── src/
```

#### Generated URLs:
- **Development**: `http://localhost:3000/uploads/properties/filename.jpg`
- **Production**: `/uploads/properties/filename.jpg` (served by same server)

#### Code Example:
```typescript
// Generates filename with timestamp + UUID
private generateFileName(extension: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0];
    return `${timestamp}-${uuid}.${extension}`;
}

// Saves file to disk
await fs.writeFile(filePath, buffer);

// Returns URL for database storage
return {
    url: `/uploads/${relativePath}`,
    publicId: relativePath // Used for deletion
};
```

### Cloudinary Storage

**File Location:** `src/services/cloudinaryImageStorage.ts`

#### How it works:
1. **Cloud Upload**: Images uploaded to Cloudinary servers
2. **Automatic Optimization**: Quality and format optimization applied
3. **Image Transformations**: Resized to max 1200x800px
4. **CDN URLs**: Returns optimized CDN URLs
5. **Public ID**: Cloudinary provides unique identifiers for deletion

#### Code Example:
```typescript
cloudinary.uploader.upload_stream({
    folder,
    resource_type: 'image',
    transformation: [
        { quality: 'auto', fetch_format: 'auto' },
        { width: 1200, height: 800, crop: 'limit' }
    ]
}, (error, result) => {
    resolve({
        url: result.secure_url,        // https://res.cloudinary.com/...
        publicId: result.public_id     // folder/filename_id
    });
}).end(buffer);
```

## Database Storage

Both storage types store **URLs as strings** in MongoDB:

```javascript
// Property document in MongoDB
{
    _id: ObjectId("..."),
    title: "Beautiful House",
    images: [
        // Local storage URLs
        "/uploads/properties/1693123456789-a1b2c3d4.jpg",
        "/uploads/properties/1693123457890-b2c3d4e5.png"
        
        // OR Cloudinary URLs  
        "https://res.cloudinary.com/demo/image/upload/v1693123456/properties/sample.jpg",
        "https://res.cloudinary.com/demo/image/upload/v1693123457/properties/house.png"
    ],
    featuredImage: "/uploads/properties/1693123456789-a1b2c3d4.jpg"
}
```

## Configuration Examples

### Local Storage Setup
```env
# .env file
IMAGE_STORAGE_TYPE=local
JWT_SECRET=your_jwt_secret_32_characters_minimum
MONGODB_URI=mongodb://localhost:27017/inmob
PORT=3000
```

**Result:**
- ✅ Images stored in `./uploads/` folder
- ✅ Served at `http://localhost:3000/uploads/...`
- ✅ No external dependencies
- ✅ Cloudinary variables not required

### Cloudinary Storage Setup
```env
# .env file
IMAGE_STORAGE_TYPE=cloudinary
JWT_SECRET=your_jwt_secret_32_characters_minimum
MONGODB_URI=mongodb://localhost:27017/inmob
PORT=3000
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Result:**
- ✅ Images stored on Cloudinary servers
- ✅ Optimized and served via CDN
- ✅ Automatic image transformations
- ✅ Professional image management

## Frontend Integration

The frontend remains **completely unchanged** regardless of storage type because:

1. **Same API Endpoints**: Upload endpoints work identically
2. **URL Strings**: Both storage types return URL strings
3. **Image Display**: `<img src={imageUrl}>` works with both local and CDN URLs

```jsx
// Frontend component works with both storage types
<img 
  src="/uploads/properties/local-image.jpg"     // Local storage
  // OR
  src="https://res.cloudinary.com/demo/..."    // Cloudinary
  alt="Property"
/>
```

## Error Handling

### Local Storage
- **Disk space**: Server disk space management required
- **File permissions**: Ensures uploads directory has write permissions
- **File corruption**: Basic error handling for disk operations

### Cloudinary Storage
- **API limits**: Respects Cloudinary API rate limits
- **Network issues**: Retry logic for upload failures
- **Authentication**: Validates Cloudinary credentials

## Migration Between Storage Types

### Local to Cloudinary
1. Change `IMAGE_STORAGE_TYPE=cloudinary` in `.env`
2. Add Cloudinary credentials
3. Existing local URLs remain functional
4. New uploads go to Cloudinary

### Cloudinary to Local
1. Change `IMAGE_STORAGE_TYPE=local` in `.env`
2. Remove Cloudinary requirement
3. Existing Cloudinary URLs remain functional (external links)
4. New uploads go to local storage

## Performance Characteristics

### Local Storage
- **Upload Speed**: ⚡ Fast (no network transfer)
- **Serving Speed**: 🐌 Depends on server resources
- **Scalability**: 📈 Limited by server disk space
- **Cost**: 💰 Server storage costs only

### Cloudinary Storage
- **Upload Speed**: 🌐 Network dependent
- **Serving Speed**: ⚡ Fast CDN delivery
- **Scalability**: 📈 Unlimited (cloud-based)
- **Cost**: 💰 Per-usage pricing

## Security Considerations

### Local Storage
- **File Access**: Controlled by server permissions
- **File Validation**: Magic number detection prevents non-images
- **Directory Traversal**: Path validation prevents security issues

### Cloudinary Storage
- **Access Control**: Managed by Cloudinary
- **HTTPS**: All URLs use secure connections
- **API Security**: Credentials required for uploads

## Troubleshooting

### Common Issues

1. **"Missing required environment variable"**
   - Solution: Add missing variables to `.env` file

2. **Local images not loading**
   - Check: Is `IMAGE_STORAGE_TYPE=local`?
   - Check: Does `uploads/` directory exist?
   - Check: Are file permissions correct?

3. **Cloudinary uploads failing**
   - Check: Are Cloudinary credentials correct?
   - Check: Is `IMAGE_STORAGE_TYPE=cloudinary`?
   - Check: Network connectivity to Cloudinary

4. **Build errors**
   - Run: `npm run build` to check TypeScript compilation
   - Check: All imports are correct

### Debug Commands
```bash
# Test local storage
IMAGE_STORAGE_TYPE=local npm run dev

# Test Cloudinary storage  
IMAGE_STORAGE_TYPE=cloudinary npm run dev

# Check build
npm run build
```

## File Summary

### Created Files
- `src/interfaces/imageStorage.ts` - Common interface
- `src/services/localImageStorage.ts` - Local filesystem implementation
- `src/services/cloudinaryImageStorage.ts` - Cloudinary implementation  
- `src/services/imageStorageFactory.ts` - Provider selection logic

### Modified Files
- `src/config/env.ts` - Added IMAGE_STORAGE_TYPE configuration
- `src/utils/imageUpload.ts` - Updated to use factory pattern
- `src/app.ts` - Added static file serving for local storage
- `README.md` - Added storage configuration documentation

This architecture provides a clean, maintainable solution that supports both storage types without breaking existing functionality.