import { useCallback, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle size={16} strokeWidth={2.5} />,
  error: <AlertCircle size={16} strokeWidth={2.5} />,
  info: <Info size={16} strokeWidth={2.5} />,
  warning: <ShieldAlert size={16} strokeWidth={2.5} />,
};

const TYPE_CLASSES: Record<string, string> = {
  success:
    "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100",
  error:
    "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-100",
  info:
    "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100",
  warning:
    "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100",
};

export default function Toast() {
  const { toasts, removeToast } = useToast();

  const dismiss = useCallback((id: string) => {
    removeToast(id);
  }, [removeToast]);

  useEffect(() => {
    // Keep only the most recent 5 toasts visible
    if (toasts.length > 5) {
      removeToast(toasts[0].id);
    }
  }, [toasts, removeToast]);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 w-80 rounded-xl border p-4 shadow-lg backdrop-blur-md ${TYPE_CLASSES[toast.type] ?? TYPE_CLASSES.info} transition-all duration-300`}
          style={{ animation: "slideIn 0.3s ease-out" }}
        >
          <div className="flex-shrink-0 mt-0.5">{TYPE_ICONS[toast.type]}</div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm leading-tight">{toast.title}</h4>
            {toast.message && (
              <p className="text-xs opacity-85 mt-1 leading-relaxed">{toast.message}</p>
            )}
          </div>
          <button
            type="button"
            className="flex-shrink-0 p-1.5 hover:opacity-70 transition-opacity"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
          >
            <span className="text-[10px]">✕</span>
          </button>
        </div>
      ))}
    </div>
  );
}
