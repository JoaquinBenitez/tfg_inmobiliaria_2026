"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ImageUpload } from '@/components/ui/image-upload'
import { Label } from '@/components/ui/label'
import { X, Star, GripVertical, Trash2, Image as ImageIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ImageAsset } from '@/types/property'

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr]
  const [removed] = result.splice(from, 1)
  result.splice(to, 0, removed)
  return result
}

interface ImageManagerProps {
  existingImages: ImageAsset[]
  onImagesChange: (images: ImageAsset[]) => void
  newImages: File[]
  onNewImagesChange: (files: File[]) => void
  featuredImageId?: string
  onFeaturedImageChange?: (publicId: string) => void
  featuredNewImageIndex?: number | null
  onFeaturedNewImageIndexChange?: (index: number | null) => void
  maxFiles?: number
  maxFileSize?: number
  disabled?: boolean
}

interface DraggableImageItemProps {
  image: ImageAsset
  index: number
  isFeatured: boolean
  isSelected: boolean
  draggedIndex: number | null
  dragOverIndex: number | null
  onToggleSelect: (index: number) => void
  onRemove: (index: number) => void
  onSetFeatured: (publicId: string) => void
  onDragStart: (index: number) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, index: number) => void
  disabled?: boolean
}

function DraggableImageItem({
  image,
  index,
  isFeatured,
  isSelected,
  draggedIndex,
  dragOverIndex,
  onToggleSelect,
  onRemove,
  onSetFeatured,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  disabled
}: DraggableImageItemProps) {
  const isDragging = draggedIndex === index
  const isDragOver = dragOverIndex === index && draggedIndex !== index

  return (
    <div
      className={`relative group rounded-lg border-2 overflow-hidden transition-all ${
        isFeatured ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      } ${isSelected ? 'ring-2 ring-accent' : ''} ${
        isDragging ? 'opacity-50' : ''
      } ${isDragOver ? 'border-primary border-dashed' : ''}`}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
    >
      {/* Drag Handle */}
      <div
        draggable={!disabled}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          onDragStart(index)
        }}
        onDragEnd={onDragEnd}
        className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing bg-background/80 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Featured Badge */}
      {isFeatured && (
        <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" />
          Destacada
        </div>
      )}

      {/* Selection Checkbox */}
      <div className="absolute top-2 left-12 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(index)}
          className="h-4 w-4 rounded border-gray-300 cursor-pointer"
          disabled={disabled}
        />
      </div>

      {/* Image */}
      <div className="aspect-video relative bg-muted">
        <Image
          src={image.url}
          alt={image.alt || `Property image ${index + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1 justify-end">
          {!isFeatured && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onSetFeatured(image.publicId)}
              disabled={disabled}
              className="h-7 px-2 text-xs"
            >
              <Star className="h-3 w-3 mr-1" />
              Destacar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => onRemove(index)}
            disabled={disabled}
            className="h-7 px-2 text-xs"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface NewImagePreviewProps {
  file: File
  index: number
  isFeatured: boolean
  onSetFeatured: (index: number) => void
  onRemove: (index: number) => void
  disabled?: boolean
}

function NewImagePreview({ file, index, isFeatured, onSetFeatured, onRemove, disabled }: NewImagePreviewProps) {
  const [previewUrl] = useState(() => URL.createObjectURL(file))

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <div
      className={`relative group rounded-lg border-2 overflow-hidden ${
        isFeatured ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      }`}
    >
      {/* Pending Featured Badge */}
      {isFeatured && (
        <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" />
          Destacada Pendiente
        </div>
      )}

      {/* Image (blob URL, bypasses the optimizer) */}
      <div className="aspect-video relative bg-muted">
        <Image
          src={previewUrl}
          alt={`New image ${index + 1}`}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1 justify-end">
          {!isFeatured && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onSetFeatured(index)}
              disabled={disabled}
              className="h-7 px-2 text-xs"
            >
              <Star className="h-3 w-3 mr-1" />
              Destacar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => onRemove(index)}
            disabled={disabled}
            className="h-7 px-2 text-xs"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ImageManager({
  existingImages,
  onImagesChange,
  newImages,
  onNewImagesChange,
  featuredImageId,
  onFeaturedImageChange,
  featuredNewImageIndex,
  onFeaturedNewImageIndexChange,
  maxFiles = 30,
  maxFileSize = 10,
  disabled = false
}: ImageManagerProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const reordered = arrayMove(existingImages, draggedIndex, dragOverIndex)
      onImagesChange(reordered)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      const reordered = arrayMove(existingImages, draggedIndex, index)
      onImagesChange(reordered)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleToggleSelect = (index: number) => {
    const newSelected = new Set(selectedIndices)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedIndices(newSelected)
  }

  const handleBulkDelete = () => {
    const remainingImages = existingImages.filter((_, index) => !selectedIndices.has(index))
    onImagesChange(remainingImages)
    setSelectedIndices(new Set())
  }

  const handleRemoveOne = (index: number) => {
    const updated = existingImages.filter((_, i) => i !== index)
    onImagesChange(updated)

    // Quitar de la selección si estaba seleccionada
    const newSelected = new Set(selectedIndices)
    newSelected.delete(index)
    setSelectedIndices(newSelected)
  }

  const handleSetFeatured = (publicId: string) => {
    onFeaturedImageChange?.(publicId)
    onFeaturedNewImageIndexChange?.(null)
  }

  const handleSetFeaturedNewImage = (index: number) => {
    onFeaturedNewImageIndexChange?.(index)
    onFeaturedImageChange?.('')
  }

  const handleRemoveNewImage = (index: number) => {
    const updated = newImages.filter((_, i) => i !== index)
    onNewImagesChange(updated)
    if (featuredNewImageIndex === index) {
      onFeaturedNewImageIndexChange?.(null)
    } else if (featuredNewImageIndex !== null && featuredNewImageIndex !== undefined && featuredNewImageIndex > index) {
      onFeaturedNewImageIndexChange?.(featuredNewImageIndex - 1)
    }
  }

  const totalImages = existingImages.length + newImages.length
  const remainingSlots = maxFiles - totalImages

  return (
    <div className="space-y-4">
      {/* Existing Images Section */}
      {existingImages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Imagenes existentes ({existingImages.length})</Label>
            {selectedIndices.size > 0 && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={disabled}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Eliminar seleccionadas ({selectedIndices.size})
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {existingImages.map((image, index) => (
              <DraggableImageItem
                key={image.publicId}
                image={image}
                index={index}
                isFeatured={featuredImageId === image.publicId}
                isSelected={selectedIndices.has(index)}
                draggedIndex={draggedIndex}
                dragOverIndex={dragOverIndex}
                onToggleSelect={handleToggleSelect}
                onRemove={handleRemoveOne}
                onSetFeatured={handleSetFeatured}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                disabled={disabled}
              />
            ))}
          </div>

          {selectedIndices.size > 0 && (
            <Alert>
              <AlertDescription className="text-xs">
                Consejo: Arrastra las imagenes para reordenarlas. La primera sera la imagen principal.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* New Images Section */}
      <div className="space-y-3">
        <Label>
          Agregar nuevas imagenes
          {remainingSlots > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              ({remainingSlots} espacios disponibles)
            </span>
          )}
        </Label>

        {remainingSlots > 0 ? (
          <ImageUpload
            value={[]}
            onChange={onNewImagesChange}
            maxFiles={remainingSlots}
            maxFileSize={maxFileSize}
            disabled={disabled}
            showPreviews={false}
          />
        ) : (
          <Alert>
            <ImageIcon className="h-4 w-4" />
            <AlertDescription>
              Numero maximo de imagenes ({maxFiles}) alcanzado. Elimina imagenes existentes para agregar nuevas.
            </AlertDescription>
          </Alert>
        )}

        {/* New image previews with featured buttons */}
        {newImages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {newImages.map((file, index) => (
              <NewImagePreview
                key={`${file.name}-${file.size}-${index}`}
                file={file}
                index={index}
                isFeatured={featuredNewImageIndex === index}
                onSetFeatured={handleSetFeaturedNewImage}
                onRemove={handleRemoveNewImage}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      <Alert>
        <AlertDescription className="text-xs space-y-1">
          <p>• Arrastra y suelta para reordenar las imagenes</p>
          <p>• Selecciona varias imagenes y haz clic en &ldquo;Eliminar seleccionadas&rdquo; para eliminar en lote</p>
          <p>• Haz clic en &ldquo;Destacar&rdquo; para establecer una imagen como la principal de la propiedad</p>
          <p>• La primera imagen de la lista se mostrara como la imagen principal en los listados</p>
        </AlertDescription>
      </Alert>
    </div>
  )
}
