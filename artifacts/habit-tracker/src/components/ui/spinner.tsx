import { Loader2Icon } from "lucide-react"
import { forwardRef } from "react"

import { cn } from "@/lib/utils"

const Spinner = forwardRef<SVGSVGElement, React.ComponentProps<"svg">>(
  ({ className, ...props }, ref) => {
    return (
      <Loader2Icon
        ref={ref}
        role="status"
        aria-label="Loading"
        className={cn("size-4 animate-spin", className)}
        {...props}
      />
    )
  }
)
Spinner.displayName = "Spinner"

export { Spinner }
