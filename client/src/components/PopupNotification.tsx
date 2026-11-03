import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { usePopup, type PopupType } from "../context/PopupContext";

const ICONS: Record<PopupType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

export default function PopupNotification() {
  const { popups, removePopup } = usePopup();

  if (!popups.length) return null;

  return (
    <div className="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
      {popups.map((popup) => {
        const Icon = ICONS[popup.type];
        return (
          <div key={popup.id} className={`toast toast--${popup.type}`} role="alert">
            <div className="toast-icon" aria-hidden>
              <Icon size={22} strokeWidth={2.2} />
            </div>
            <div className="toast-body">
              <strong className="toast-title">{popup.title}</strong>
              {popup.message ? <p className="toast-message">{popup.message}</p> : null}
            </div>
            <button type="button" className="toast-close" onClick={() => removePopup(popup.id)} aria-label="Dismiss notification">
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
