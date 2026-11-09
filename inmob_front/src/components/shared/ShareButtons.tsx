'use client'

import { useState } from 'react'
import { Property } from '@/types/property'
import { Share2, MessageSquare, Mail, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

interface ShareButtonsProps {
  property: Property
  url?: string
}

export function ShareButtons({ property, url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  // Obtener la URL de la página actual o usar la URL provista
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')

  const shareText = `${property.title} - ${formatCurrency(property.price, property.currency)} ${property.listingType === 'sale' ? 'en Venta' : 'en Alquiler'} | ${property.location.address}, ${property.location.city}`

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(`${shareText}\n\n${shareUrl}`)
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    window.open(facebookUrl, '_blank', 'width=600,height=400')
  }

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
    window.open(twitterUrl, '_blank', 'width=600,height=400')
  }

  const handleEmailShare = () => {
    const subject = encodeURIComponent(property.title)
    const body = encodeURIComponent(
      `Hola,\n\nQuería compartir esta propiedad contigo:\n\n${shareText}\n\nDetalles:\n- ${property.bedrooms} dormitorios\n- ${property.bathrooms} baños\n- ${property.area} m²\n\nVer más: ${shareUrl}`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self')
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-muted-foreground mr-2">
        <Share2 className="h-4 w-4 inline mr-1" />
        Compartir:
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={handleWhatsAppShare}
        className="text-success hover:bg-success/10 hover:text-success"
      >
        <MessageSquare className="h-4 w-4 mr-1" />
        WhatsApp
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleFacebookShare}
        className="hover:bg-primary/10 hover:text-primary"
      >
        <svg
          className="h-4 w-4 mr-1"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        Facebook
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleTwitterShare}
        className="hover:bg-primary/10 hover:text-primary"
      >
        <svg
          className="h-4 w-4 mr-1"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Twitter
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleEmailShare}
        className="hover:bg-accent"
      >
        <Mail className="h-4 w-4 mr-1" />
        Email
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyLink}
        className={copied ? 'bg-success/10 text-success border-success' : ''}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 mr-1" />
            Copiado
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 mr-1" />
            Copiar Link
          </>
        )}
      </Button>
    </div>
  )
}
