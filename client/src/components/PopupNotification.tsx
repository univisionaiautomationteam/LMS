import { useCallback, useEffect } from "react";
import { usePopup } from "../context/PopupContext";

const POPUP_ICONS: Record<string, React.ReactNode> = {
  success: <span className="text-green-500">✓</span>,
  error: <span className="text-red-500">✕</span>,
  info: <span className="text-blue-500">ℹ</span>,
  warning: <span className="text-amber-500">⚠</span>,
};

const POPUP_COLORS: Record<string, string> = {
  success: "border-green-400 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  error: "border-red-400 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  info: "border-blue-400 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  warning: "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
};

export default function PopupNotification() {
  const { popups, removePopup } = usePopup();

  const dismiss = useCallback((id: string) => {
    removePopup(id);
  }, [removePopup]);

  // Auto-dismiss all popups after their duration
  useEffect(() => {
    if (popups.length === 0) return;
    const timers = popups.map((p) => {
      const duration = p.duration ?? 5000;
      return setTimeout(() => removePopup(p.id), duration);
    });
    return () => timers.forEach((t) => clearTimeout(t));
  }, [popups, removePopup]);

  if (!popups.length) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-md">
      {popups.map((popup) => (
        <div
          key={popup.id}
          className={`pointer-events-auto flex items-start gap-3 w-full rounded-xl border p-4 shadow-2xl backdrop-blur-md transform transition-all duration-300 ${
            POPUP_COLORS[popup.type]
          }`}
        >
          <div className="flex-shrink-0 mt-0.5">{POPUP_ICONS[popup.type]}</div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm leading-tight">{popup.title}</h4>
            {popup.message && (
              <p className="text-xs opacity-85 mt-1 leading-relaxed">{popup.message}</p>
            )}
          </div>
          <button
            type="button"
            className="flex-shrink-0 p-1.5 hover:opacity-70 transition-opacity"
            onClick={() => dismiss(popup.id)}
            aria-label="Dismiss"
          >
            <span className="text-[10px]">✕</span>
          </button>
        </div>
      ))}
    </div>
  );
}
