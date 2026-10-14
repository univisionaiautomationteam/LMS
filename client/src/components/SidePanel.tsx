import { useEffect, type ReactNode } from "react";

/**
 * Right-hand detail panel used for every drill-down on the dashboard
 * (college structure, add-college form, ...). Consistent, dismissible with
 * the X, a backdrop click, or Escape. Body scroll is locked while open.
 */
export default function SidePanel({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="panel-overlay" onClick={onClose} role="presentation">
      <aside className="side-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="side-panel-head">
          <div className="side-panel-heading">
            {subtitle && <span className="eyebrow">{subtitle}</span>}
            <div className="side-panel-title">{title}</div>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close panel">×</button>
        </header>
        <div className="side-panel-body">{children}</div>
        {footer && <footer className="side-panel-footer">{footer}</footer>}
      </aside>
    </div>
  );
}
