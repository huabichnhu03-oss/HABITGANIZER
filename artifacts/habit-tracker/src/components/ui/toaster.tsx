import { AlertTriangle, CheckCircle2, Coins, Info } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const VARIANT_ICON = {
  default: Info,
  accent: Coins,
  success: CheckCircle2,
  info: Info,
  destructive: AlertTriangle,
} as const

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon = VARIANT_ICON[(variant ?? "default") as keyof typeof VARIANT_ICON] ?? Info
        return (
          <Toast key={id} variant={variant} {...props}>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-[2px] border-foreground bg-background"
              aria-hidden
            >
              <Icon className="h-4 w-4" strokeWidth={3} />
            </span>
            <div className="grid gap-1 flex-1 min-w-0">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
