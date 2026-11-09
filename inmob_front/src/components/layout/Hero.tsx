// src/components/layout/Hero.tsx
import PropertySearch from '@/components/shared/PropertySearch';
import HeroCarousel from '@/components/shared/FeaturedPropertiesCarousel';

export default function Hero() {
    return (
        <>
            <HeroCarousel />
            <div className="absolute bottom-8 sm:bottom-32 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-4">
                <PropertySearch />
            </div>
        </>
    );
}