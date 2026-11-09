# Real Estate API Backend

Backend API for a real estate website built with Node.js, Express 5, TypeScript, and MongoDB (Mongoose 9).

## Features

- Property listings management (sale/rent) with pagination and sorting
- Simple and advanced search with multiple filters
- Geospatial search (nearby radius, map viewport bounds)
- Featured properties endpoint
- Filter endpoints for dropdowns (bedrooms, locations, property types)
- Admin authentication with JWT and role-based access (admin/editor)
- Configurable image storage (Cloudinary or local filesystem)
- Rate limiting for API protection
- Environment variable validation on startup
- Password strength validation
- Automated test suite (Vitest + Supertest + in-memory MongoDB)

## Prerequisites

- Node.js 20.19+ (22 LTS recommended)
- MongoDB (v4.4 or higher)
- npm

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file in the root directory:
```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/inmob
PORT=3000

# JWT Configuration (required, must be 32+ characters)
JWT_SECRET=your_super_secret_jwt_key_here_32_characters_minimum

# Image Storage Configuration
IMAGE_STORAGE_TYPE=cloudinary  # Options: 'local' or 'cloudinary' (default: cloudinary)

# Cloudinary Configuration (required when IMAGE_STORAGE_TYPE=cloudinary)
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here

# Environment (optional, defaults to development)
NODE_ENV=development

# Local uploads base directory (optional, defaults to ./uploads when IMAGE_STORAGE_TYPE=local)
# UPLOADS_BASE_DIR=

# Production CORS (optional, comma-separated frontend URLs)
FRONTEND_URLS=https://yourdomain.com,https://www.yourdomain.com
```

The application validates all required environment variables on startup. Missing or invalid variables will prevent the server from starting.

## Image Storage Options

The application supports two image storage modes:

### 1. Cloudinary Storage (Default)
```env
IMAGE_STORAGE_TYPE=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```
- Professional image optimization, CDN delivery, automatic transformations
- Best for production deployments

### 2. Local Filesystem Storage
```env
IMAGE_STORAGE_TYPE=local
# Cloudinary variables not required
# UPLOADS_BASE_DIR=/custom/path  # Optional override (defaults to ./uploads)
```
- No external dependencies, simple setup
- Images stored in `./uploads/` and served at `/uploads/` endpoint
- Uploaded files are deleted automatically when properties/images are removed
- Best for development and testing

## Testing

The backend has a full test suite (149 tests) using **Vitest**, **Supertest**, and **mongodb-memory-server**:

```bash
npm test               # Single run
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

- Tests run against an in-memory MongoDB — no local database or Cloudinary credentials required; dev data is never touched
- Image upload/delete tests use an OS temp directory via `UPLOADS_BASE_DIR`
- Rate limiters are disabled automatically under `NODE_ENV=test`
- **Note:** the first run downloads a MongoDB binary (~70MB, cached afterwards)

Layout: `tests/unit/` (models, middleware, utils, services) and `tests/integration/` (HTTP routes), with helpers in `tests/helpers/` and global setup in `tests/setup.ts`.

## Starting the Application

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Create Admin User

```bash
npm run create-admin
```

Default credentials: `admin@inmob.com` / `admin123456`. Change the password after first login.

## API Endpoints

### Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties/all` | Get all properties with pagination, filtering, and sorting |
| GET | `/api/properties/getOne/:id` | Get a specific property by ID |
| POST | `/api/properties/create` | Create a new property (multipart/form-data for images) |
| PUT | `/api/properties/update/:id` | Update a property |
| DELETE | `/api/properties/delete/:id` | Delete a property (also deletes associated images) |
| POST | `/api/properties/:id/images` | Upload images to an existing property |
| GET | `/api/properties/search` | Simple search with filters |
| GET | `/api/properties/search/advanced` | Advanced search with multiple filters |
| GET | `/api/properties/featured` | Get featured properties |

### Geospatial Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties/nearby` | Find properties within a radius (`?lat=&lng=&radius=`) |
| GET | `/api/properties/bounds` | Find properties in map viewport (`?neLat=&neLng=&swLat=&swLng=`) |

### Filters

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties/filters/bedrooms` | Get bedroom options for dropdowns |
| GET | `/api/properties/filters/locations` | Get location/city options |
| GET | `/api/properties/filters/property-types` | Get property type options |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login (rate limited) |
| GET | `/api/auth/me` | Get current authenticated user |
| PUT | `/api/auth/profile` | Update user profile |
| POST | `/api/auth/register` | Create new user (admin only, rate limited) |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/hero` | Get hero images/title/subtitle (public) |
| PUT | `/api/settings/hero` | Update hero settings with optional image uploads (admin only, max 3 images) |
| DELETE | `/api/settings/hero/images` | Delete a single hero image (admin only) |

## Search Parameters

### Simple Search (`/api/properties/search`)

- `type`: Listing type (`sale` or `rent`)
- `propertyType`: Property type (`departamento`, `casa`, `terreno`, `oficina`, `local`)
- `bedrooms`: Number of bedrooms
- `city`: City name

### Advanced Search (`/api/properties/search/advanced`)

- `type`: Listing type (`sale` or `rent`)
- `propertyTypes`: Comma-separated property types
- `cities`: Comma-separated city names
- `minPrice`: Minimum price
- `maxPrice`: Maximum price
- `minBedrooms`: Minimum bedrooms
- `maxBedrooms`: Maximum bedrooms
- `status`: Property status (`available`, `reserved`, or `sold`)

## Authentication

The API uses JWT for authentication. Protected endpoints require a `Bearer` token in the `Authorization` header.

Roles:
- **Admin** - Full access including user management
- **Editor** - Property management access (create, read, update)

Middleware:
- `authenticateToken` - Verifies JWT and attaches user to request
- `requireAdmin` - Restricts to admin role
- `requireAdminOrEditor` - Allows admin or editor roles

## Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| General API | 100 requests / 15 minutes |
| Authentication | 5 attempts / 15 minutes |
| Property modifications | 10 requests / minute |
| Image uploads | 20 requests / minute |
| Search queries | 60 requests / minute |

Development mode uses relaxed limits for easier testing. Rate limiters are disabled entirely when `NODE_ENV=test` (see [Testing](#testing)).

## Example Requests

### Create a Property

```bash
curl -X POST http://localhost:3000/api/properties/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Beautiful House",
    "description": "A lovely property",
    "price": 250000,
    "location": {
      "type": "Point",
      "coordinates": [-60.7, -31.6333],
      "address": "123 Main St",
      "city": "Santa Fe"
    },
    "bedrooms": 3,
    "bathrooms": 2,
    "area": 150,
    "propertyType": "casa",
    "type": "sale",
    "status": "available",
    "images": ["https://example.com/image1.jpg"]
  }'
```

### Search Properties

```bash
# Simple search: houses for sale
curl "http://localhost:3000/api/properties/search?type=sale&propertyType=casa"

# Advanced search: apartments in Santa Fe, 2-3 bedrooms
curl "http://localhost:3000/api/properties/search/advanced?propertyTypes=departamento&cities=Santa%20Fe&minBedrooms=2&maxBedrooms=3"

# Nearby search: properties within 5km of coordinates
curl "http://localhost:3000/api/properties/nearby?lat=-31.6333&lng=-60.7&radius=5"

# Map bounds search
curl "http://localhost:3000/api/properties/bounds?neLat=-31.6&neLng=-60.6&swLat=-31.7&swLng=-60.8"
```

## Property Model

A property has the following fields:

- `title`: Name/title of the property (required)
- `description`: Detailed description (required)
- `price`: Price in currency units (required)
- `location`: Geographic information (required)
  - `type`: Always "Point"
  - `coordinates`: [longitude, latitude]
  - `address`: Street address
  - `city`: City name
- `bedrooms`: Number of bedrooms (required)
- `bathrooms`: Number of bathrooms (required)
- `area`: Area in square meters (required)
- `propertyType`: One of `departamento`, `casa`, `terreno`, `oficina`, `local` (required)
- `type`: Either `sale` or `rent` (required)
- `status`: One of `available`, `reserved`, or `sold` (default: `available`)
- `images`: Array of image URLs
- `featured`: Whether the property is featured (default: false)
- `featuredImage`: Image URL for featured property card (required if featured is true)
