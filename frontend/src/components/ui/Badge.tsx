import type { ReactNode } from 'react';

export type BadgeVariant = 'success' | 'neutral' | 'warning' | 'danger' | 'accent' | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span className={['ui-badge', `ui-badge--${variant}`, className].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}
