"use client"

import * as React from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { X, Upload } from "lucide-react"

export interface ImageUploadProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string[]
  onChange?: (files: File[]) => void
  onRemove?: (index: number) => void
  disabled?: boolean
  maxFiles?: number
  maxFileSize?: number // in MB
  accept?: string
  showPreviews?: boolean
}

const ImageUpload = React.forwardRef<HTMLDivElement, ImageUploadProps>(
  ({ 
    className,
    value = [],
    onChange,
    onRemove,
    disabled = false,
    maxFiles = 30,
    maxFileSize = 10,
    accept = "image/*",
    showPreviews = true,
    ...props
  }, ref) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [isDragOver, setIsDragOver] = React.useState(false)
    const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
    const [previews, setPreviews] = React.useState<string[]>([])

    // Generar previews de los archivos seleccionados
    React.useEffect(() => {
      if (selectedFiles.length === 0) {
        setPreviews([])
        return
      }

      const newPreviews: string[] = []
      selectedFiles.forEach((file) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            newPreviews.push(e.target.result as string)
            if (newPreviews.length === selectedFiles.length) {
              setPreviews([...newPreviews])
            }
          }
        }
        reader.readAsDataURL(file)
      })

      return () => {
        newPreviews.forEach(preview => URL.revokeObjectURL(preview))
      }
    }, [selectedFiles])

    const handleFileSelect = (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      
      // Filtrar archivos por tipo y tamaño
      const validFiles = fileArray.filter(file => {
        if (!file.type.startsWith('image/')) return false
        if (file.size > maxFileSize * 1024 * 1024) return false
        return true
      })

      // Limitar la cantidad de archivos
      const totalFiles = selectedFiles.length + validFiles.length
      const filesToAdd = totalFiles > maxFiles 
        ? validFiles.slice(0, maxFiles - selectedFiles.length)
        : validFiles

      if (filesToAdd.length > 0) {
        const newFiles = [...selectedFiles, ...filesToAdd]
        setSelectedFiles(newFiles)
        onChange?.(newFiles)
      }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFileSelect(e.target.files)
      }
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      
      if (disabled) return
      
      if (e.dataTransfer.files) {
        handleFileSelect(e.dataTransfer.files)
      }
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (!disabled) {
        setIsDragOver(true)
      }
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
    }

    const removeFile = (index: number) => {
      const newFiles = selectedFiles.filter((_, i) => i !== index)
      setSelectedFiles(newFiles)
      onChange?.(newFiles)
      onRemove?.(index)
    }

    const openFileDialog = () => {
      if (!disabled) {
        fileInputRef.current?.click()
      }
    }

    return (
      <div className={cn("space-y-4", className)} ref={ref} {...props}>
        {/* Upload Area */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragOver 
              ? "border-primary bg-primary/5" 
              : "border-gray-300 hover:border-gray-400",
            disabled && "opacity-50 cursor-wait"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={openFileDialog}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled}
          />
          
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground/60" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-muted-foreground/80">
              PNG, JPG, GIF up to {maxFileSize}MB (max {maxFiles} files)
            </div>
          </div>
        </div>

        {/* Preview Grid */}
        {showPreviews && (previews.length > 0 || value.length > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Existing images from value prop */}
            {value.map((url, index) => (
              <div key={`existing-${index}`} className="relative group">
                <div className="aspect-square rounded-lg border bg-muted/30 overflow-hidden">
                  <Image
                    src={url}
                    alt={`Property image ${index + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 200px"
                    className="object-cover"
                  />
                </div>
                {!disabled && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemove?.(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}

            {/* New file previews */}
            {previews.map((preview, index) => (
              <div key={`preview-${index}`} className="relative group">
                <div className="aspect-square rounded-lg border bg-muted/30 overflow-hidden">
                  <Image
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 200px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                {!disabled && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* File count info */}
        {showPreviews && selectedFiles.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
            {maxFiles && ` (${maxFiles - selectedFiles.length} remaining)`}
          </div>
        )}
      </div>
    )
  }
)

ImageUpload.displayName = "ImageUpload"

export { ImageUpload }