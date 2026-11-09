# Real Estate Website Frontend

Next.js 16 frontend for the Real Estate Website project with an admin system, built with TypeScript, Tailwind CSS 4, and shadcn/ui.

## Features

- Property listings with pagination and advanced search
- Map-based search with Leaflet (radius and viewport bounds)
- Property comparison (up to 3 properties side-by-side, localStorage-based)
- Social sharing (WhatsApp, Facebook, Twitter/X, Email, Copy Link)
- WhatsApp contact integration with pre-filled property info
- Image galleries with Next.js Image optimization
- Rich text editor (TipTap) for property descriptions
- Image drag-and-drop upload and reordering (native HTML5 drag & drop)
- Filter caching for dropdown options
- Admin dashboard with property management (CRUD)
- Authentication with Auth.js v5 and role-based access
- Dynamic sitemap at `/sitemap.xml`
- JSON-LD structured data (RealEstateListing schema)
- Open Graph and Twitter card meta tags
- Breadcrumb navigation
- Back-to-top floating button
- Print-friendly property detail pages
- Error boundaries for graceful error handling
- Responsive design (single light theme; brand colors configurable via ThemeContext)

## Getting Started

### Prerequisites
- Node.js 20.19+ (22 LTS recommended)
- Backend API running on port 3000

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Configuration

Create `.env.local`:
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
API_URL=http://localhost:3000/api

# Authentication (Auth.js)
AUTH_SECRET=your_super_secret_auth_key_here_32_characters_minimum
NEXTAUTH_URL=http://localhost:3001

# Site URL (used for sitemap, Open Graph)
NEXT_PUBLIC_SITE_URL=http://localhost:3001

# Contact Information
NEXT_PUBLIC_WHATSAPP_NUMBER=5491234567890
NEXT_PUBLIC_PHONE_NUMBER=+5491234567890
NEXT_PUBLIC_CONTACT_EMAIL=contacto@inmobiliaria.com

# Optional
NEXT_PUBLIC_DEFAULT_HERO_IMAGE=/images/default-hero.jpg
```

### Development

```bash
# Start development server on port 3001 (recommended)
npm run dev

# Or start on default port 3000
npm run dev:default
```

Open http://localhost:3001 to see the website.
Access the admin panel at http://localhost:3001/admin/login.

### Build for Production

```bash
npm run build
npm start
# Or on specific port
npm run start:3001
```

### Code Quality

```bash
npm run lint
```

## Project Structure

```
inmob_front/
├── src/
│   ├── proxy.ts                    # Next.js 16 proxy (admin route protection via NextAuth)
│   ├── app/                         # Next.js 16 App Router
│   │   ├── admin/
│   │   │   ├── login/               # Admin login page
│   │   │   ├── dashboard/           # Admin dashboard
│   │   │   ├── properties/          # Property management
│   │   │   │   ├── create/          # Create property
│   │   │   │   └── [id]/edit/       # Edit property
│   │   │   └── layout.tsx           # Admin layout
│   │   ├── alquiler/                # Rental listings page
│   │   ├── venta/                   # Sale listings page
│   │   ├── propiedades/[id]/        # Property detail page
│   │   ├── buscar-en-mapa/          # Map-based search page
│   │   ├── comparar/                # Property comparison page
│   │   ├── contacto/                # Contact page
│   │   ├── nosotros/                # About page
│   │   ├── api/auth/[...nextauth]/  # Auth.js API route
│   │   ├── sitemap.ts               # Dynamic sitemap generation
│   │   ├── layout.tsx               # Root layout with providers
│   │   └── page.tsx                 # Homepage
│   ├── components/
│   │   ├── admin/                   # Admin-specific components
│   │   ├── shared/                  # Reusable components
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── layout/                  # Layout components (Navbar, Hero)
│   │   └── ErrorBoundary.tsx        # Error boundary component
│   ├── contexts/                    # React contexts
│   ├── hooks/                       # Custom React hooks
│   ├── lib/                         # Utilities, API functions, auth config
│   ├── config/                      # App configuration and constants
│   └── types/                       # TypeScript type definitions
└── public/                          # Static assets
```

## Pages and Routes

### Public Pages
| Route | Description |
|-------|-------------|
| `/` | Homepage with featured properties carousel |
| `/venta` | Properties for sale listing |
| `/alquiler` | Properties for rent listing |
| `/propiedades/[id]` | Property detail page with gallery, sharing, contact |
| `/buscar-en-mapa` | Interactive map search with Leaflet |
| `/comparar` | Side-by-side property comparison |
| `/contacto` | Contact page |
| `/nosotros` | About page |

### Admin Pages
| Route | Description |
|-------|-------------|
| `/admin/login` | Admin authentication |
| `/admin/dashboard` | Dashboard with property statistics |
| `/admin/properties` | Property management table |
| `/admin/properties/create` | Create new property |
| `/admin/properties/[id]/edit` | Edit existing property |

## Key Components

### Shared Components
- **PropertyCard** - Property card with image, details, comparison button
- **PropertyList** - Property listing grid with loading/error states
- **PropertySearch** - Search and filter interface
- **AdvancedFiltersModal** - Advanced multi-filter search modal
- **FeaturedPropertiesCarousel** - Homepage featured properties carousel
- **MapSearch** - Interactive Leaflet map with markers, clustering, radius search
- **ShareButtons** - Social sharing (WhatsApp, Facebook, Twitter/X, Email, Copy Link)
- **PropertyImageGallery** - Responsive image gallery for property pages
- **PropertyContactForm** - Contact form with WhatsApp, phone, and email options
- **Breadcrumbs** - Automatic breadcrumb navigation
- **BackToTop** - Floating scroll-to-top button
- **ComparisonBadge** - Navbar badge showing comparison count

### Admin Components
- **AdminLayout** - Protected admin layout with sidebar navigation
- **AdminProvider** - Admin context provider
- **PropertyForm** - Property creation/editing form with rich text editor
- **PropertyTable** - Data table for property management
- **ImageManager** - Image upload, preview, and reordering
- **PropertyPreview** - Live preview of property being edited
- **ProtectedRoute** - Route protection with authentication checks

### UI Components (shadcn/ui)
- **StatusBadge** - Property status indicators (available/reserved/sold)
- **ImageUpload** - Drag & drop image upload with preview
- **RichTextEditor** - TipTap rich text editor for descriptions
- **PropertyMap** - Leaflet map component for property locations
- Standard shadcn/ui: Button, Card, Input, Label, Alert, DropdownMenu, NavigationMenu

## Custom Hooks

- **usePropertyComparison** - Manages property comparison state in localStorage
- **useFilterOptions** - Fetches and caches filter dropdown options (bedrooms, locations, types)
- **useUnsavedChanges** - Detects unsaved form changes and prompts before navigation

## Context Providers

- **ThemeContext** - Brand color theming via CSS variables
- **FilterCacheContext** - Caches filter options to avoid repeated API calls

## Styling

- **Tailwind CSS 4** for utility-first styling (CSS-first configuration — theme tokens and keyframes are defined in `globals.css` via `@theme`; there is no `tailwind.config.ts`)
- **shadcn/ui** for consistent UI components
- **CSS Variables** for semantic design tokens (defined in `globals.css`)
- Print-optimized styles for property pages

## Authentication

- **Auth.js v5** for secure authentication
- **JWT tokens** with role-based access (admin/editor)
- **Protected routes** with automatic redirects
- **Data access layer** (`src/lib/data-access.ts`) for server-side operations

## Deployment

### Vercel (Recommended)
```bash
vercel --prod
```

### Environment Variables for Production
```env
AUTH_SECRET=generate_a_strong_64_character_secret
NEXTAUTH_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

## Related Files

- **Main README**: `../README.md` - Complete project overview
- **Backend README**: `../inmob_back/README.md` - API documentation
- **Development Guide**: `../AGENTS.md` - Development guidance
