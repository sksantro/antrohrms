import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
}

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    to?: never;
  };

type LinkButtonProps = BaseProps & {
  to: string;
  disabled?: boolean;
};

function buildClassName(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return ['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, className].filter(Boolean).join(' ');
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={buildClassName(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  to,
  disabled,
}: LinkButtonProps) {
  if (disabled) {
    return (
      <span className={`${buildClassName(variant, size, className)} ui-btn--disabled`}>
        {children}
      </span>
    );
  }

  return (
    <Link className={buildClassName(variant, size, className)} to={to}>
      {children}
    </Link>
  );
}
