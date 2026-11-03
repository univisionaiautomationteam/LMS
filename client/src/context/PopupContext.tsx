import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type PopupType = "success" | "error" | "info" | "warning";

export interface PopupNotification {
  id: string;
  type: PopupType;
  title: string;
  message?: string;
  duration?: number;
}

export interface PopupContextType {
  popups: PopupNotification[];
  showPopup: (popup: Omit<PopupNotification, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  removePopup: (id: string) => void;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

let nextId = 0;

const POPUP_ICONS: Record<PopupType, React.ReactNode> = {
  success: <CheckCircle size={18} strokeWidth={2.5} />,
  error: <AlertCircle size={18} strokeWidth={2.5} />,
  info: <Info size={18} strokeWidth={2.5} />,
  warning: <AlertTriangle size={18} strokeWidth={2.5} />,
};

const POPUP_COLORS: Record<PopupType, string> = {
  success: "border-green-400 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  error: "border-red-400 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  info: "border-blue-400 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  warning: "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
};

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [popups, setPopups] = useState<PopupNotification[]>([]);

  const showPopup = useCallback((popup: Omit<PopupNotification, "id">) => {
    const id = String(++nextId);
    const newPopup: PopupNotification = { ...popup, id };
    setPopups((prev) => [...prev, newPopup]);
    const duration = popup.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setPopups((prev) => prev.filter((p) => p.id !== id));
      }, duration);
    }
  }, []);

  const removePopup = useCallback((id: string) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const success = useCallback(
    (title: string, message?: string) =>
      showPopup({ type: "success", title, message, duration: 4000 }),
    [showPopup]
  );

  const error = useCallback(
    (title: string, message?: string) =>
      showPopup({ type: "error", title, message, duration: 6000 }),
    [showPopup]
  );

  const info = useCallback(
    (title: string, message?: string) =>
      showPopup({ type: "info", title, message, duration: 4000 }),
    [showPopup]
  );

  const warning = useCallback(
    (title: string, message?: string) =>
      showPopup({ type: "warning", title, message, duration: 5000 }),
    [showPopup]
  );

  const value = useMemo(
    () => ({ popups, showPopup, success, error, info, warning, removePopup }),
    [popups, showPopup, success, error, info, warning, removePopup]
  );

  return <PopupContext.Provider value={value}>{children}</PopupContext.Provider>;
}

export function usePopup() {
  const ctx = useContext(PopupContext);
  if (!ctx) {
    throw new Error("usePopup must be used within a PopupProvider");
  }
  return ctx;
}
