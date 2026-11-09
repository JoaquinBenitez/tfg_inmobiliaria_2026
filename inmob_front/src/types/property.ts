export interface ImageAsset {
  url: string
  publicId: string
  width?: number
  alt?: string
}

// ---------------------------------------------------------------------------
// 360° tour (Requirement 1) — mirrors the backend tour DTO
// ---------------------------------------------------------------------------

export interface SceneCoverage {
  minYaw: number;
  maxYaw: number;
  minPitch: number;
  maxPitch: number;
}

export interface SceneInitialView {
  pitch: number;
  yaw: number;
  fov: number;
}

export interface TourHotspot {
  id: string;
  toScene: string;
  pitch: number;
  yaw: number;
  label: string;
}

export interface TourScene {
  id: string;
  name: string;
  /** Nested per scene (locked decision 2026-09-05). */
  hotspots: TourHotspot[];
  image: {
    url: string;
    publicId: string;
    avifUrl?: string;
    avifPublicId?: string;
    mobileUrl?: string;
    mobilePublicId?: string;
    mobileAvifUrl?: string;
    mobileAvifPublicId?: string;
    posterUrl: string;
    posterPublicId: string;
    width: number;
    height: number;
  };
  coverage?: SceneCoverage;
  initialView: SceneInitialView;
}

export interface Tour {
  enabled: boolean;
  scenes: TourScene[];
}

export interface TourUpdatePayload {
  enabled?: boolean;
  scenes?: Array<{
    id: string;
    name?: string;
    initialView?: SceneInitialView;
    coverage?: SceneCoverage | null;
    hotspots?: TourHotspot[];
  }>;
}

export type PropertyStatus = 'available' | 'reserved' | 'sold' | 'rented';

export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: 'USD' | 'ARS';
  location: {
    address: string;
    city: string;
    lat: number;
    lng: number;
  };
  bedrooms: number;
  bathrooms: number;
  area: number;
  propertyType: 'departamento' | 'casa' | 'terreno' | 'oficina' | 'local';
  listingType: 'sale' | 'rent';
  status: PropertyStatus;
  images: ImageAsset[];
  tour?: Tour;
  featured: boolean;
  featuredImageId: string;
  deletedAt?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
