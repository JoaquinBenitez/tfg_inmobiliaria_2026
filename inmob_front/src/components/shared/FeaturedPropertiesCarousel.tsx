'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { config } from '@/config';
import { fetchApi } from '@/lib/api';
import { HeroSettings } from '@/types/settings';

const DEFAULT_HERO_IMAGE = process.env.NEXT_PUBLIC_DEFAULT_HERO_IMAGE || '/images/default-hero.jpg';

export default function HeroCarousel() {
    const [settings, setSettings] = useState<HeroSettings | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [prevIndex, setPrevIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);
    const [direction, setDirection] = useState<'left' | 'right' | null>(null);
    const slideTimerRef = useRef<NodeJS.Timeout | null>(null);

    const images = useMemo(() => settings?.heroImages || [], [settings]);

    const changeSlide = useCallback((dir: 'left' | 'right') => {
        if (isAnimating) return;

        setIsAnimating(true);
        setDirection(dir);
        setPrevIndex(currentIndex);

        if (dir === 'right') {
            setCurrentIndex((prev) =>
                prev === images.length - 1 ? 0 : prev + 1
            );
        } else {
            setCurrentIndex((prev) =>
                prev === 0 ? images.length - 1 : prev - 1
            );
        }

        setTimeout(() => {
            setIsAnimating(false);
            setDirection(null);
        }, 700);
    }, [isAnimating, currentIndex, images.length]);

    // Mantener un ref estable al último changeSlide para que el interval siempre
    // invokes fresh state without re-arming on every animation flag change
    const changeSlideRef = useRef(changeSlide);
    useEffect(() => {
        changeSlideRef.current = changeSlide;
    }, [changeSlide]);

    // Avanzar el carrusel automáticamente
    useEffect(() => {
        if (images.length > 1) {
            slideTimerRef.current = setInterval(() => {
                changeSlideRef.current('right');
            }, 7000);
        }

        return () => {
            if (slideTimerRef.current) {
                clearInterval(slideTimerRef.current);
            }
        };
    }, [images, currentIndex]);

    const handleDotClick = (index: number) => {
        if (isAnimating || index === currentIndex) return;

        setIsAnimating(true);
        setDirection(index > currentIndex ? 'right' : 'left');
        setPrevIndex(currentIndex);
        setCurrentIndex(index);

        setTimeout(() => {
            setIsAnimating(false);
            setDirection(null);
        }, 700);
    };

    useEffect(() => {
        const fetchHeroSettings = async () => {
            try {
                const data = await fetchApi<HeroSettings>(
                    config.endpoints.settings.hero
                );
                setSettings(data);
            } catch {
                // Settings aún no configurados, usar defaults
            } finally {
                setIsLoading(false);
            }
        };

        fetchHeroSettings();
    }, []);

    if (isLoading) {
        return (
            <div className="relative h-screen flex items-center justify-center bg-background">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    // Fallback cuando no hay imágenes del hero configuradas
    if (images.length === 0) {
        return (
            <div className="relative h-screen">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url(${DEFAULT_HERO_IMAGE})`,
                        filter: 'brightness(0.7)'
                    }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
                    <div className="max-w-2xl text-center mb-48 sm:mb-32">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-white">
                            {settings?.heroTitle || 'Bienvenido'}
                        </h1>
                        {settings?.heroSubtitle && (
                            <p className="text-base sm:text-lg md:text-xl text-white/90">
                                {settings.heroSubtitle}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const currentImage = images[currentIndex];
    const previousImage = images[prevIndex];
    const showNavigation = images.length > 1;

    return (
        <div className="relative h-screen overflow-hidden">
            {/* Previous Image (for transition) */}
            {isAnimating && (
                <div
                    className={`absolute inset-0 bg-cover bg-center z-0 ${
                        direction === 'right'
                            ? 'animate-slide-out-left'
                            : 'animate-slide-out-right'
                    }`}
                    style={{
                        backgroundImage: `url(${previousImage})`,
                        filter: 'brightness(0.7)'
                    }}
                />
            )}

            {/* Current Image */}
            <div
                className={`absolute inset-0 bg-cover bg-center z-0 ${
                    isAnimating
                        ? direction === 'right'
                            ? 'animate-slide-in-right'
                            : 'animate-slide-in-left'
                        : 'transition-opacity duration-1000'
                }`}
                style={{
                    backgroundImage: `url(${currentImage})`,
                    filter: 'brightness(0.7)'
                }}
            />

            {/* Navigation Buttons */}
            {showNavigation && (
                <>
                    <button
                        onClick={() => changeSlide('left')}
                        disabled={isAnimating}
                        className="absolute left-1 top-1/2 transform -translate-y-1/2 text-white p-2 rounded-full
                            bg-black/30 hover:bg-black/50 transition-all duration-300
                            active:scale-90 active:bg-black/70 z-20 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Previous slide"
                    >
                        <ChevronLeft className="w-8 h-8" />
                    </button>
                    <button
                        onClick={() => changeSlide('right')}
                        disabled={isAnimating}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 text-white p-2 rounded-full
                            bg-black/30 hover:bg-black/50 transition-all duration-300
                            active:scale-90 active:bg-black/70 z-20 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Next slide"
                    >
                        <ChevronRight className="w-8 h-8" />
                    </button>
                </>
            )}

            {/* Content */}
            <div
                className={`absolute inset-0 flex flex-col items-center justify-center px-4 z-10 pointer-events-none ${
                    isAnimating ? 'animate-fade-in' : ''
                }`}
                style={{ top: '10%' }}
            >
                <div className="max-w-2xl text-center mb-48 sm:mb-32">
                    <h1 className={`font-bold mb-4 text-white ${(settings?.heroTitle || '').length > 20 ? 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl' : 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'}`}>
                        {settings?.heroTitle || 'Bienvenido'}
                    </h1>
                    {settings?.heroSubtitle && (
                        <p className="text-base sm:text-lg md:text-xl text-white/90 mb-6 line-clamp-3">
                            {settings.heroSubtitle}
                        </p>
                    )}
                </div>
            </div>

            {/* Dots */}
            {showNavigation && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-3 z-20">
                    {images.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => handleDotClick(index)}
                            disabled={isAnimating}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${
                                index === currentIndex
                                    ? 'bg-white scale-125'
                                    : 'bg-white/50 hover:bg-white/70'
                            }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
