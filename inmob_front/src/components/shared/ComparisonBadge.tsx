'use client'

import { usePropertyComparison } from '@/hooks/usePropertyComparison'
import { Button } from '@/components/ui/button'
import { GitCompare } from 'lucide-react'
import Link from 'next/link'

export function ComparisonBadge() {
  const { count } = usePropertyComparison()

  if (count === 0) return null

  return (
    <Link href="/comparar">
      <Button variant="outline" className="relative">
        <GitCompare className="h-4 w-4 mr-2" />
        Comparar
        <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
          {count}
        </span>
      </Button>
    </Link>
  )
}
