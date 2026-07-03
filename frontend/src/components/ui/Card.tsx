import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  wide?: boolean;
  padding?: 'md' | 'lg';
}

interface CardHeaderProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function Card({ children, className, wide = false, padding = 'lg' }: CardProps) {
  return (
    <section
      className={[
        'ui-card',
        wide ? 'ui-card--wide' : '',
        padding === 'md' ? 'ui-card--compact' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, description, actions, children }: CardHeaderProps) {
  if (children) {
    return <div className="ui-card-header">{children}</div>;
  }

  return (
    <div className="ui-card-header">
      <div>
        {title ? <h2 className="ui-card-title">{title}</h2> : null}
        {description ? <p className="ui-card-description">{description}</p> : null}
      </div>
      {actions ? <div className="ui-card-actions">{actions}</div> : null}
    </div>
  );
}
