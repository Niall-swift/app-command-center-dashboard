import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import {
  useOptionalUiPreferences,
  type NotificationPositionMode,
  type NotificationStyleMode,
} from "@/contexts/UiPreferencesContext"
import { cn } from "@/lib/utils"

const VIEWPORT_POSITION_CLASS: Record<NotificationPositionMode, string> = {
  "top-right":
    "fixed top-0 right-0 bottom-auto left-auto z-[100] flex max-h-screen w-full flex-col p-4 sm:top-0 sm:right-0 sm:bottom-auto md:max-w-[400px]",
  "top-center":
    "fixed top-0 left-1/2 -translate-x-1/2 bottom-auto right-auto z-[100] flex max-h-screen w-full flex-col p-4 sm:top-0 sm:bottom-auto sm:right-auto md:max-w-[420px]",
  "bottom-right":
    "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[400px]",
  "bottom-center":
    "fixed bottom-0 left-1/2 -translate-x-1/2 top-auto right-auto z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:top-auto sm:right-auto md:max-w-[420px]",
}

const RADIX_TOAST_STYLE_CLASS: Record<NotificationStyleMode, string> = {
  modern: "rounded-xl p-4 pr-8 shadow-lg bg-card/95 backdrop-blur-md",
  glass:
    "rounded-2xl p-4 pr-8 border-white/25 dark:border-white/15 bg-background/72 dark:bg-zinc-900/72 backdrop-blur-2xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.34)]",
  solid:
    "rounded-lg p-4 pr-8 border-2 border-l-4 border-l-primary bg-card shadow-xl",
  minimal:
    "rounded-lg px-3.5 py-2.5 pr-8 border-border/80 bg-card shadow-sm",
  pill:
    "rounded-3xl px-5 py-3 pr-9 border-border/70 bg-card/95 backdrop-blur-md shadow-xl",
}

export function Toaster() {
  const { toasts } = useToast()
  const uiPrefs = useOptionalUiPreferences()
  const styleMode = uiPrefs?.preferences.notificationStyle ?? "modern"
  const positionMode = uiPrefs?.preferences.notificationPosition ?? "top-right"

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, className, ...props }) {
        return (
          <Toast
            key={id}
            className={cn(RADIX_TOAST_STYLE_CLASS[styleMode], className)}
            {...props}
          >
            <div className="grid gap-0.5">
              {title && (
                <ToastTitle className={styleMode === "minimal" ? "text-xs" : undefined}>
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className={styleMode === "minimal" ? "text-[11px]" : undefined}>
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport className={VIEWPORT_POSITION_CLASS[positionMode]} />
    </ToastProvider>
  )
}
