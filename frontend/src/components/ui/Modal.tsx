import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  icon?: ReactNode;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
  icon,
  subtitle,
  size = 'md',
  className,
}: ModalProps) {
  if (!open) {
    return null;
  }

  const modalClassName = ['ui-modal', `ui-modal--${size}`, className].filter(Boolean).join(' ');

  return (
    <div className="ui-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={modalClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ui-modal-header">
          <div className="ui-modal-heading">
            {icon ? <span className="ui-modal-icon" aria-hidden>{icon}</span> : null}
            <div>
              <h3 id="modal-title">{title}</h3>
              {subtitle ? <p className="ui-modal-subtitle">{subtitle}</p> : null}
            </div>
          </div>
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer ? <div className="ui-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
