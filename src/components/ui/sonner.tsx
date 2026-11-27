import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"
import {
  useOptionalUiPreferences,
  type NotificationStyleMode,
} from "@/contexts/UiPreferencesContext"

type ToasterProps = React.ComponentProps<typeof Sonner>

const SONNER_STYLE_CLASSES: Record<NotificationStyleMode, string> = {
  modern:
    "group toast rounded-xl group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
  glass:
    "group toast avl-toast-glass rounded-2xl backdrop-blur-2xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.32)]",
  solid:
    "group toast avl-toast-solid rounded-lg border-l-4 shadow-xl font-medium",
  minimal:
    "group toast avl-toast-minimal rounded-lg py-2.5 px-3.5 text-xs shadow-sm group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/80",
  pill:
    "group toast avl-toast-pill rounded-3xl px-4 py-2.5 shadow-xl",
}

const Toaster = ({ position, richColors, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const uiPrefs = useOptionalUiPreferences()
  const styleMode = uiPrefs?.preferences.notificationStyle ?? "modern"
  const activePosition = uiPrefs?.preferences.notificationPosition ?? position ?? "top-right"
  const useRichColors =
    styleMode === "minimal" || styleMode === "glass"
      ? false
      : richColors ?? true

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={activePosition}
      richColors={useRichColors}
      className={`toaster group avl-toaster-${styleMode}`}
      toastOptions={{
        classNames: {
          toast: SONNER_STYLE_CLASSES[styleMode],
          title: styleMode === "minimal" ? "text-xs font-semibold" : "font-semibold",
          description:
            styleMode === "minimal"
              ? "text-[11px] group-[.toast]:text-muted-foreground"
              : "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground rounded-lg",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground rounded-lg",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
