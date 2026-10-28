import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = String(++nextId);
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (title: string, message?: string) =>
      showToast({ type: "success", title, message, duration: 4000 }),
    [showToast]
  );

  const error = useCallback(
    (title: string, message?: string) =>
      showToast({ type: "error", title, message, duration: 6000 }),
    [showToast]
  );

  const info = useCallback(
    (title: string, message?: string) =>
      showToast({ type: "info", title, message, duration: 4000 }),
    [showToast]
  );

  const warning = useCallback(
    (title: string, message?: string) =>
      showToast({ type: "warning", title, message, duration: 5000 }),
    [showToast]
  );

  const value = useMemo(
    () => ({ toasts, showToast, success, error, info, warning, removeToast }),
    [toasts, showToast, success, error, info, warning, removeToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
