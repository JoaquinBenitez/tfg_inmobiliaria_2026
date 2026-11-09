'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Image from 'next/image';

interface PropertyImageGalleryProps {
    images: string[];
    title: string;
}

export default function PropertyImageGallery({ images, title }: PropertyImageGalleryProps) {
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [showModal, setShowModal] = useState(false);

    if (!images || images.length === 0) {
        return (
            <div className="space-y-4">
                <div className="relative h-96 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground">No hay imágenes disponibles</span>
                </div>
            </div>
        );
    }

    const nextImage = () => {
        setSelectedImageIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = () => {
        setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const openModal = (index: number) => {
        setSelectedImageIndex(index);
        setShowModal(true);
    };

    return (
        <>
            <div className="space-y-4">
                {/* Main Image */}
                <div className="relative h-96 rounded-lg overflow-hidden group">
                    <Image 
                        src={images[selectedImageIndex]} 
                        alt={`${title} - Imagen principal`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
                        className="object-cover cursor-pointer transition-transform hover:scale-105"
                        onClick={() => openModal(selectedImageIndex)}
                        priority
                    />
                    
                    {/* Navigation arrows for main image */}
                    {images.length > 1 && (
                        <>
                            <button
                                onClick={prevImage}
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={nextImage}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </>
                    )}
                    
                    {/* Image counter */}
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                        {selectedImageIndex + 1} / {images.length}
                    </div>
                </div>
                
                {/* Thumbnail Grid */}
                {images.length > 1 && (
                    <div className="grid grid-cols-6 gap-2">
                        {images.slice(0, 6).map((image, index) => (
                            <div 
                                key={index} 
                                className={`relative h-16 rounded overflow-hidden cursor-pointer border-2 transition-all ${
                                    selectedImageIndex === index 
                                        ? 'border-primary' 
                                        : 'border-transparent hover:border-primary/50'
                                }`}
                                onClick={() => setSelectedImageIndex(index)}
                            >
                                <Image 
                                    src={image} 
                                    alt={`${title} - Miniatura ${index + 1}`}
                                    fill
                                    sizes="120px"
                                    className="object-cover"
                                />
                            </div>
                        ))}
                        
                        {images.length > 6 && (
                            <div 
                                className="relative h-16 rounded overflow-hidden bg-muted flex items-center justify-center cursor-pointer border-2 border-transparent hover:border-primary/50 transition-all"
                                onClick={() => openModal(6)}
                            >
                                <span className="text-xs font-medium text-center">
                                    +{images.length - 6}<br/>más
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Full Screen Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
                    <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center p-4">
                        {/* Close button */}
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full hover:bg-black/70 transition-colors z-10"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        
                        {/* Navigation arrows */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={prevImage}
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white bg-black/50 p-3 rounded-full hover:bg-black/70 transition-colors z-10"
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={nextImage}
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white bg-black/50 p-3 rounded-full hover:bg-black/70 transition-colors z-10"
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </button>
                            </>
                        )}
                        
                        {/* Main modal image */}
                        <div className="relative w-full h-full max-w-7xl max-h-7xl">
                            <Image
                                src={images[selectedImageIndex]}
                                alt={`${title} - Imagen ${selectedImageIndex + 1}`}
                                fill
                                sizes="100vw"
                                className="object-contain"
                            />
                        </div>
                        
                        {/* Image counter */}
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black/50 px-4 py-2 rounded-full">
                            {selectedImageIndex + 1} / {images.length}
                        </div>
                        
                        {/* Thumbnail strip at bottom */}
                        {images.length > 1 && (
                            <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex space-x-2 max-w-full overflow-x-auto px-4">
                                {images.map((image, index) => (
                                    <div
                                        key={index}
                                        className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden cursor-pointer border-2 transition-all ${
                                            selectedImageIndex === index 
                                                ? 'border-white' 
                                                : 'border-transparent hover:border-white/50'
                                        }`}
                                        onClick={() => setSelectedImageIndex(index)}
                                    >
                                        <Image
                                            src={image}
                                            alt={`Miniatura ${index + 1}`}
                                            fill
                                            sizes="64px"
                                            className="object-cover"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}