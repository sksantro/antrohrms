import type { ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, icon, className }: FormSectionProps) {
  return (
    <section className={['ui-form-section', className].filter(Boolean).join(' ')}>
      <div className="ui-form-section-header">
        <div className="ui-form-section-heading">
          {icon ? <span className="ui-form-section-icon" aria-hidden>{icon}</span> : null}
          <h3>{title}</h3>
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="ui-form-section-body">{children}</div>
    </section>
  );
}
