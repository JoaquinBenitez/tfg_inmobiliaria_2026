import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import type { PropertyStatus } from "@/types/property"

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      status: {
        available: "bg-success text-success-foreground",
        reserved: "bg-warning text-warning-foreground", 
        sold: "bg-muted text-muted-foreground",
        rented: "bg-muted text-muted-foreground",
      },
      size: {
        default: "px-2 py-1 text-xs",
        sm: "px-1.5 py-0.5 text-xs",
        lg: "px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      status: "available",
      size: "default",
    },
  }
)

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status: PropertyStatus
  children?: React.ReactNode
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, size, children, ...props }, ref) => {
    const statusLabels = {
      available: 'Disponible',
      reserved: 'Reservado', 
      sold: 'Vendido',
      rented: 'Alquilado'
    }

    return (
      <span
        className={cn(statusBadgeVariants({ status, size, className }))}
        ref={ref}
        {...props}
      >
        {children || statusLabels[status]}
      </span>
    )
  }
)
StatusBadge.displayName = "StatusBadge"

export { StatusBadge, statusBadgeVariants }