import * as React from "react"
import { cn } from "@/lib/utils"

interface SelectableItemProps extends React.HTMLAttributes<HTMLDivElement> {
  isSelected: boolean
  children: React.ReactNode
}

const SelectableItem = React.forwardRef<HTMLDivElement, SelectableItemProps>(
  ({ className, isSelected, children, ...props }, ref) => {
    return (
      <div
        className={cn(
          "py-2 px-4 cursor-pointer transition-colors",
          isSelected 
            ? "bg-accent text-accent-foreground" 
            : "hover:bg-accent/50",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    )
  }
)
SelectableItem.displayName = "SelectableItem"

export { SelectableItem }