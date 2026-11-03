import { createContext, useCallback, useContext, useMemo, useState } from "react";

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
