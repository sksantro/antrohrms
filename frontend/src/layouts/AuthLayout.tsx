import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  subtitle?: string;
  title?: string;
  tagline?: string;
}

export function AuthLayout({
  children,
  subtitle,
  title = 'Antro HRMS',
  tagline = 'Secure workforce management portal',
}: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <span className="auth-orb auth-orb--one" aria-hidden />
      <span className="auth-orb auth-orb--two" aria-hidden />
      <span className="auth-orb auth-orb--three" aria-hidden />

      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-logo-badge">
              <img src="/antro-logo.png" alt="Antro" className="auth-logo" />
            </span>
            <h1 className="auth-title">{title}</h1>
            <p className="auth-tagline">{tagline}</p>
            {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
          </div>
          {children}
        </div>
        <p className="auth-footer">© 2026 Antro. Secure HRMS access.</p>
      </div>
    </div>
  );
}
